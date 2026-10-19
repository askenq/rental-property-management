
import { Router } from "express";

export default function createAnalyticsRouter(prisma, authenticateToken) {
    const router = Router();

    router.use(authenticateToken);

    // GET /api/analytics?period=12
    // period: 3, 6 или 12 месяцев
    router.get("/", async (req, res) => {
        try {
            const ownerId = Number(req.user?.userId ?? req.user?.id);

            if (!Number.isInteger(ownerId) || ownerId <= 0) {
                return res.status(401).json({
                    message: "Не удалось определить пользователя"
                });
            }

            const allowedPeriods = [3, 6, 12];
            const requestedPeriod = Number(req.query.period);
            const period = allowedPeriods.includes(requestedPeriod)
                ? requestedPeriod
                : 12;

            const now = new Date();
            const startDate = new Date(
                now.getFullYear(),
                now.getMonth() - period + 1,
                1
            );

            const [
                properties,
                contracts,
                payments,
                tenants,
                requests
            ] = await Promise.all([
                prisma.property.findMany({
                    where: { ownerId },
                    select: {
                        id: true,
                        name: true,
                        address: true,
                        rent: true,
                        status: true,
                        type: true,
                        area: true
                    }
                }),

                prisma.contract.findMany({
                    where: { ownerId },
                    select: {
                        id: true,
                        number: true,
                        startDate: true,
                        endDate: true,
                        rent: true,
                        status: true,
                        propertyId: true,
                        tenantId: true,
                        property: {
                            select: {
                                id: true,
                                name: true,
                                address: true
                            }
                        },
                        tenant: {
                            select: {
                                id: true,
                                fullName: true
                            }
                        }
                    }
                }),

                prisma.payment.findMany({
                    where: {
                        ownerId,
                        dueDate: {
                            gte: startDate
                        }
                    },
                    select: {
                        id: true,
                        amount: true,
                        dueDate: true,
                        paidAt: true,
                        status: true,
                        contractId: true,
                        contract: {
                            select: {
                                number: true,
                                property: {
                                    select: {
                                        id: true,
                                        name: true
                                    }
                                },
                                tenant: {
                                    select: {
                                        id: true,
                                        fullName: true
                                    }
                                }
                            }
                        }
                    },
                    orderBy: {
                        dueDate: "asc"
                    }
                }),

                prisma.tenant.findMany({
                    where: { ownerId },
                    select: {
                        id: true,
                        status: true
                    }
                }),

                prisma.request.findMany({
                    where: { ownerId },
                    select: {
                        id: true,
                        title: true,
                        status: true,
                        priority: true,
                        type: true,
                        createdAt: true,
                        completedAt: true
                    }
                })
            ]);

            const money = (value) =>
                Math.round((Number(value) + Number.EPSILON) * 100) / 100;

            const sum = (items) =>
                money(items.reduce(
                    (total, item) => total + Number(item.amount || 0),
                    0
                ));

            const currentMonthStart = new Date(
                now.getFullYear(),
                now.getMonth(),
                1
            );

            const nextMonthStart = new Date(
                now.getFullYear(),
                now.getMonth() + 1,
                1
            );

            const activeContracts = contracts.filter(
                (item) => item.status === "ACTIVE"
            );

            const occupiedProperties = properties.filter(
                (item) => item.status === "RENTED"
            );

            const availableProperties = properties.filter(
                (item) => item.status === "AVAILABLE"
            );

            const maintenanceProperties = properties.filter(
                (item) => item.status === "MAINTENANCE"
            );

            // Для финансовых итогов используем фактический статус платежа.
            const paidPayments = payments.filter(
                (item) => item.status === "PAID"
            );

            const pendingPayments = payments.filter(
                (item) => item.status === "PENDING"
            );

            const overduePayments = payments.filter(
                (item) => item.status === "OVERDUE"
            );

            const paidAmount = sum(paidPayments);
            const pendingAmount = sum(pendingPayments);
            const overdueAmount = sum(overduePayments);

            const currentMonthPayments = payments.filter((payment) => {
                const date = new Date(payment.dueDate);
                return date >= currentMonthStart && date < nextMonthStart;
            });

            const currentMonthPaid = currentMonthPayments.filter(
                (item) => item.status === "PAID"
            );

            // Помесячная динамика начислений и фактических оплат.
            const monthly = [];

            for (let i = 0; i < period; i++) {
                const monthStart = new Date(
                    now.getFullYear(),
                    now.getMonth() - period + 1 + i,
                    1
                );

                const monthEnd = new Date(
                    monthStart.getFullYear(),
                    monthStart.getMonth() + 1,
                    1
                );

                const monthPayments = payments.filter((payment) => {
                    const date = new Date(payment.dueDate);
                    return date >= monthStart && date < monthEnd;
                });

                const paidInMonth = monthPayments.filter((payment) => {
                    if (payment.status !== "PAID" || !payment.paidAt) {
                        return false;
                    }

                    const date = new Date(payment.paidAt);

                    return date >= monthStart && date < monthEnd;
                });

                monthly.push({
                    key: `${monthStart.getFullYear()}-${String(
                        monthStart.getMonth() + 1
                    ).padStart(2, "0")}`,

                    label: monthStart.toLocaleDateString("ru-RU", {
                        month: "short",
                        year: "2-digit"
                    }),

                    accrued: sum(monthPayments),
                    paid: sum(paidInMonth),
                    pending: sum(
                        monthPayments.filter(
                            (payment) => payment.status === "PENDING"
                        )
                    ),
                    overdue: sum(
                        monthPayments.filter(
                            (payment) => payment.status === "OVERDUE"
                        )
                    )
                });
            }

            // Рейтинг объектов по начислениям за выбранный период.
            const propertyStats = properties.map((property) => {
                const propertyPayments = payments.filter(
                    (payment) =>
                        payment.contract?.property?.id === property.id
                );

                const propertyContracts = activeContracts.filter(
                    (contract) => contract.propertyId === property.id
                );

                return {
                    id: property.id,
                    name: property.name,
                    address: property.address,
                    type: property.type,
                    status: property.status,
                    rent: money(property.rent),
                    activeContracts: propertyContracts.length,
                    accrued: sum(propertyPayments),
                    received: sum(
                        propertyPayments.filter(
                            (payment) => payment.status === "PAID"
                        )
                    ),
                    debt: sum(
                        propertyPayments.filter(
                            (payment) =>
                                payment.status === "PENDING" ||
                                payment.status === "OVERDUE"
                        )
                    )
                };
            }).sort((a, b) => b.received - a.received);

            const expiringSoon = activeContracts
                .filter((contract) => {
                    const end = new Date(contract.endDate);
                    const days = (end - now) / (1000 * 60 * 60 * 24);

                    return days >= 0 && days <= 30;
                })
                .map((contract) => ({
                    id: contract.id,
                    number: contract.number,
                    endDate: contract.endDate,
                    rent: money(contract.rent),
                    property: contract.property?.name ?? "Объект",
                    tenant: contract.tenant?.fullName ?? "Арендатор"
                }))
                .sort(
                    (a, b) =>
                        new Date(a.endDate) - new Date(b.endDate)
                );

            const requestStatuses = [
                "NEW",
                "IN_PROGRESS",
                "WAITING",
                "COMPLETED",
                "CANCELLED"
            ].map((status) => ({
                status,
                count: requests.filter(
                    (request) => request.status === status
                ).length
            }));

            const requestPriorities = [
                "LOW",
                "NORMAL",
                "HIGH",
                "URGENT"
            ].map((priority) => ({
                priority,
                count: requests.filter(
                    (request) => request.priority === priority
                ).length
            }));

            const completedRequests = requests.filter(
                (request) => request.status === "COMPLETED"
            );

            const occupancyRate = properties.length
                ? money(
                    occupiedProperties.length /
                    properties.length * 100
                )
                : 0;

            res.json({
                period,
                generatedAt: now.toISOString(),

                summary: {
                    propertiesTotal: properties.length,
                    propertiesOccupied: occupiedProperties.length,
                    propertiesAvailable: availableProperties.length,
                    propertiesMaintenance: maintenanceProperties.length,
                    occupancyRate,

                    tenantsTotal: tenants.length,
                    tenantsActive: tenants.filter(
                        (tenant) => tenant.status === "ACTIVE"
                    ).length,

                    contractsTotal: contracts.length,
                    contractsActive: activeContracts.length,
                    contractsExpiringSoon: expiringSoon.length,

                    paymentsTotal: payments.length,
                    paidCount: paidPayments.length,
                    pendingCount: pendingPayments.length,
                    overdueCount: overduePayments.length,

                    paidAmount,
                    pendingAmount,
                    overdueAmount,

                    currentMonthAccrued: sum(currentMonthPayments),
                    currentMonthReceived: sum(currentMonthPaid),

                    requestsTotal: requests.length,
                    requestsOpen: requests.filter(
                        (request) =>
                            !["COMPLETED", "CANCELLED"].includes(
                                request.status
                            )
                    ).length,
                    requestsCompleted: completedRequests.length
                },

                monthly,
                properties: propertyStats,
                expiringSoon,
                requests: {
                    byStatus: requestStatuses,
                    byPriority: requestPriorities
                }
            });
        } catch (error) {
            console.error("Ошибка аналитики:", error);

            res.status(500).json({
                message: "Не удалось загрузить аналитику"
            });
        }
    });

    return router;
}
