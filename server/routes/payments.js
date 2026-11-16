import express from "express";

export default function createPaymentsRouter(
    prisma,
    authenticateToken
) {
    const router = express.Router();

    function parseId(value) {
        const id = Number(value);

        return Number.isInteger(id) && id > 0
            ? id
            : null;
    }

    // Используем календарные даты в UTC,
    // чтобы не получать сдвиги из-за часового пояса.
    function utcDay(date) {
        return new Date(Date.UTC(
            date.getUTCFullYear(),
            date.getUTCMonth(),
            date.getUTCDate()
        ));
    }

    function dateKey(date) {
        return [
            date.getUTCFullYear(),
            String(date.getUTCMonth() + 1).padStart(2, "0"),
            String(date.getUTCDate()).padStart(2, "0")
        ].join("-");
    }

    function getDueDate(year, month, paymentDay) {
        const lastDay = new Date(
            Date.UTC(year, month + 1, 0)
        ).getUTCDate();

        return new Date(Date.UTC(
            year,
            month,
            Math.min(paymentDay, lastDay)
        ));
    }

    function getContractSchedule(contract) {
        const start = new Date(contract.startDate);
        const end = new Date(contract.endDate);

        if (
            !Number.isFinite(contract.rent) ||
            contract.rent < 0 ||
            Number.isNaN(start.getTime()) ||
            Number.isNaN(end.getTime()) ||
            end < start
        ) {
            return null;
        }

        const paymentDay = Number(contract.paymentDay || 1);

        if (
            !Number.isInteger(paymentDay) ||
            paymentDay < 1 ||
            paymentDay > 31
        ) {
            return null;
        }

        const startDay = utcDay(start);
        const endDay = utcDay(end);
        const dates = [];

        let year = startDay.getUTCFullYear();
        let month = startDay.getUTCMonth();

        const lastYear = endDay.getUTCFullYear();
        const lastMonth = endDay.getUTCMonth();

        while (
            year < lastYear ||
            (year === lastYear && month <= lastMonth)
        ) {
            const dueDate = getDueDate(
                year,
                month,
                paymentDay
            );

            if (
                dueDate >= startDay &&
                dueDate <= endDay
            ) {
                dates.push(dueDate);
            }

            month++;

            if (month > 11) {
                month = 0;
                year++;
            }
        }

        return dates;
    }

    async function refreshOverdue(ownerId) {
        const today = utcDay(new Date());

        await prisma.payment.updateMany({
            where: {
                ownerId,
                status: "PENDING",
                dueDate: {
                    lt: today
                }
            },
            data: {
                status: "OVERDUE"
            }
        });

        await prisma.payment.updateMany({
            where: {
                ownerId,
                status: "OVERDUE",
                dueDate: {
                    gte: today
                }
            },
            data: {
                status: "PENDING"
            }
        });
    }

    // GET /api/payments
    
router.get(
    "/",
    authenticateToken,
    async (req, res) => {
        try {
            let payments;

            if (req.user.role === "TENANT") {
                const userId = Number(req.user.userId);

                const tenant = await prisma.tenant.findUnique({
                    where: {
                        userId
                    },
                    select: {
                        id: true,
                        contracts: {
                            select: {
                                id: true
                            }
                        }
                    }
                });

                if (!tenant) {
                    return res.status(404).json({
                        message: "Профиль арендатора не найден"
                    });
                }

                const contractIds = tenant.contracts.map(
                    contract => contract.id
                );

                if (contractIds.length) {
                    const today = utcDay(new Date());

                    await prisma.payment.updateMany({
                        where: {
                            contractId: {
                                in: contractIds
                            },
                            status: "PENDING",
                            dueDate: {
                                lt: today
                            }
                        },
                        data: {
                            status: "OVERDUE"
                        }
                    });

                    await prisma.payment.updateMany({
                        where: {
                            contractId: {
                                in: contractIds
                            },
                            status: "OVERDUE",
                            dueDate: {
                                gte: today
                            }
                        },
                        data: {
                            status: "PENDING"
                        }
                    });
                }

                payments = await prisma.payment.findMany({
                    where: {
                        contractId: {
                            in: contractIds
                        }
                    },
                    include: {
                        contract: {
                            select: {
                                id: true,
                                number: true,
                                startDate: true,
                                endDate: true,
                                rent: true,
                                status: true,
                                tenant: {
                                    select: {
                                        id: true,
                                        fullName: true
                                    }
                                },
                                property: {
                                    select: {
                                        id: true,
                                        name: true,
                                        address: true
                                    }
                                }
                            }
                        }
                    },
                    orderBy: [
                        { dueDate: "desc" },
                        { id: "desc" }
                    ]
                });
            } else if (
                ["OWNER", "MANAGER"].includes(req.user.role)
            ) {
                const ownerId = req.user.userId;

                await refreshOverdue(ownerId);

                payments = await prisma.payment.findMany({
                    where: {
                        ownerId
                    },
                    include: {
                        contract: {
                            select: {
                                id: true,
                                number: true,
                                startDate: true,
                                endDate: true,
                                rent: true,
                                status: true,
                                tenant: {
                                    select: {
                                        id: true,
                                        fullName: true
                                    }
                                },
                                property: {
                                    select: {
                                        id: true,
                                        name: true,
                                        address: true
                                    }
                                }
                            }
                        }
                    },
                    orderBy: [
                        { dueDate: "desc" },
                        { id: "desc" }
                    ]
                });
            } else {
                return res.status(403).json({
                    message: "Недостаточно прав для просмотра платежей"
                });
            }

            const summary = payments.reduce(
                (result, payment) => {
                    const amount = Number(payment.amount) || 0;

                    if (payment.status === "PAID") {
                        result.paid += amount;
                        result.paidCount++;
                    } else {
                        result.debt += amount;

                        if (payment.status === "OVERDUE") {
                            result.overdue += amount;
                            result.overdueCount++;
                        } else {
                            result.pendingCount++;
                        }
                    }

                    return result;
                },
                {
                    paid: 0,
                    debt: 0,
                    overdue: 0,
                    paidCount: 0,
                    overdueCount: 0,
                    pendingCount: 0,
                    totalCount: payments.length
                }
            );

            return res.json({
                payments,
                summary
            });
        } catch (error) {
            console.error(
                "Ошибка получения платежей:",
                error
            );

            return res.status(500).json({
                message: "Не удалось загрузить платежи"
            });
        }
    }
);


    // POST /api/payments/generate
    // Синхронизация графика по активным договорам.
    router.post(
        "/generate",
        authenticateToken,
        async (req, res) => {
            try {
                const ownerId = req.user.userId;

                const contracts = await prisma.contract.findMany({
                    where: {
                        ownerId,
                        status: "ACTIVE"
                    },
                    select: {
                        id: true,
                        number: true,
                        rent: true,
                        startDate: true,
                        endDate: true,
                        paymentDay: true
                    }
                });

                let createdCount = 0;
                let skippedCount = 0;
                let removedCount = 0;
                let preservedPaidCount = 0;
                let invalidContracts = 0;

                for (const contract of contracts) {
                    const schedule = getContractSchedule(contract);

                    if (!schedule) {
                        invalidContracts++;
                        continue;
                    }

                    const desiredDates = new Set(
                        schedule.map(dateKey)
                    );

                    await prisma.$transaction(async tx => {
                        const existing = await tx.payment.findMany({
                            where: {
                                ownerId,
                                contractId: contract.id
                            },
                            orderBy: {
                                dueDate: "asc"
                            }
                        });

                        const existingKeys = new Set(
                            existing.map(payment =>
                                dateKey(utcDay(new Date(payment.dueDate)))
                            )
                        );

                        // Создаём недостающие платежи.
                        for (const dueDate of schedule) {
                            const key = dateKey(dueDate);

                            if (existingKeys.has(key)) {
                                skippedCount++;
                                continue;
                            }

                            await tx.payment.create({
                                data: {
                                    amount: contract.rent,
                                    dueDate,
                                    status:
                                        dueDate < utcDay(new Date())
                                            ? "OVERDUE"
                                            : "PENDING",
                                    ownerId,
                                    contractId: contract.id
                                }
                            });

                            createdCount++;
                        }

                        // Убираем старые неоплаченные начисления,
                        // даты которых больше не входят в договор.
                        for (const payment of existing) {
                            const key = dateKey(
                                utcDay(new Date(payment.dueDate))
                            );

                            if (desiredDates.has(key)) {
                                continue;
                            }

                            if (payment.status === "PAID") {
                                // Оплаченные записи и их история сохраняются.
                                preservedPaidCount++;
                                continue;
                            }

                            await tx.payment.delete({
                                where: {
                                    id: payment.id
                                }
                            });

                            removedCount++;
                        }
                    });
                }

                await refreshOverdue(ownerId);

                const paymentsTotal = await prisma.payment.count({
                    where: {
                        ownerId
                    }
                });

                res.json({
                    message: "Синхронизация графика завершена",
                    contractsProcessed: contracts.length,
                    paymentsTotal,
                    createdCount,
                    skippedCount,
                    removedCount,
                    preservedPaidCount,
                    invalidContracts
                });
            } catch (error) {
                console.error(
                    "Ошибка генерации платежей:",
                    error
                );

                res.status(500).json({
                    message: "Не удалось синхронизировать график платежей"
                });
            }
        }
    );

    // PATCH /api/payments/:id/status
    router.patch(
        "/:id/status",
        authenticateToken,
        async (req, res) => {
            try {
                const id = parseId(req.params.id);

                if (!id) {
                    return res.status(400).json({
                        message: "Некорректный ID платежа"
                    });
                }

                const { status } = req.body;

                if (!["PAID", "PENDING"].includes(status)) {
                    return res.status(400).json({
                        message: "Допустимые статусы: PAID, PENDING"
                    });
                }

                const ownerId = req.user.userId;

                const existingPayment =
                    await prisma.payment.findFirst({
                        where: {
                            id,
                            ownerId
                        }
                    });

                if (!existingPayment) {
                    return res.status(404).json({
                        message: "Платёж не найден"
                    });
                }

                const today = utcDay(new Date());
                const dueDate = utcDay(
                    new Date(existingPayment.dueDate)
                );

                const payment = await prisma.payment.update({
                    where: {
                        id
                    },
                    data: {
                        status:
                            status === "PAID"
                                ? "PAID"
                                : dueDate < today
                                    ? "OVERDUE"
                                    : "PENDING",
                        paidAt:
                            status === "PAID"
                                ? new Date()
                                : null
                    }
                });

                res.json({
                    message:
                        status === "PAID"
                            ? "Платёж отмечен как оплаченный"
                            : "Статус платежа обновлён",
                    payment
                });
            } catch (error) {
                console.error(
                    "Ошибка изменения платежа:",
                    error
                );

                res.status(500).json({
                    message: "Не удалось изменить платёж"
                });
            }
        }
    );

    return router;
}