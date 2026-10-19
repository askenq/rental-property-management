
import express from "express";

export default function createRequestsRouter(prisma, authenticateToken) {
    const router = express.Router();

    const statuses = [
        "NEW",
        "IN_PROGRESS",
        "WAITING",
        "COMPLETED",
        "CANCELLED"
    ];

    const priorities = [
        "LOW",
        "NORMAL",
        "HIGH",
        "URGENT"
    ];

    const types = [
        "REPAIR",
        "PLUMBING",
        "ELECTRICITY",
        "HEATING",
        "CLEANING",
        "OTHER"
    ];

    function getOwnerId(req) {
        return Number(req.user?.userId ?? req.user?.id);
    }

    function parseId(value) {
        const id = Number(value);
        return Number.isInteger(id) && id > 0 ? id : null;
    }

    function validateOwnerId(ownerId) {
        return Number.isInteger(ownerId) && ownerId > 0;
    }

    function validateRequestBody(body, partial = false) {
        const errors = [];

        if (!partial || body.title !== undefined) {
            if (
                typeof body.title !== "string" ||
                body.title.trim().length < 3 ||
                body.title.trim().length > 200
            ) {
                errors.push("Название должно содержать от 3 до 200 символов");
            }
        }

        if (!partial || body.description !== undefined) {
            if (
                typeof body.description !== "string" ||
                body.description.trim().length < 3 ||
                body.description.trim().length > 10000
            ) {
                errors.push("Описание должно содержать от 3 до 10000 символов");
            }
        }

        if (
            body.type !== undefined &&
            !types.includes(body.type)
        ) {
            errors.push("Некорректный тип заявки");
        }

        if (
            body.status !== undefined &&
            !statuses.includes(body.status)
        ) {
            errors.push("Некорректный статус заявки");
        }

        if (
            body.priority !== undefined &&
            !priorities.includes(body.priority)
        ) {
            errors.push("Некорректный приоритет заявки");
        }

        if (
            body.tenantId !== undefined &&
            body.tenantId !== null &&
            !parseId(body.tenantId)
        ) {
            errors.push("Некорректный ID арендатора");
        }

        if (
            body.assignedToId !== undefined &&
            body.assignedToId !== null &&
            !parseId(body.assignedToId)
        ) {
            errors.push("Некорректный ID ответственного");
        }

        return errors;
    }

    const includeRequest = {
        property: {
            select: {
                id: true,
                name: true,
                address: true,
                ownerId: true
            }
        },
        tenant: {
            select: {
                id: true,
                fullName: true,
                email: true,
                phone: true
            }
        },
        assignedTo: {
            select: {
                id: true,
                name: true,
                email: true,
                role: true
            }
        }
    };

    // GET /api/requests
    // Список заявок текущего владельца.
    router.get("/", authenticateToken, async (req, res) => {
        try {
            const ownerId = getOwnerId(req);

            if (!validateOwnerId(ownerId)) {
                return res.status(401).json({
                    message: "Не удалось определить пользователя"
                });
            }

            const { status, priority, type, search } = req.query;

            const where = { ownerId };

            if (status && status !== "ALL") {
                if (!statuses.includes(status)) {
                    return res.status(400).json({
                        message: "Некорректный фильтр статуса"
                    });
                }

                where.status = status;
            }

            if (priority && priority !== "ALL") {
                if (!priorities.includes(priority)) {
                    return res.status(400).json({
                        message: "Некорректный фильтр приоритета"
                    });
                }

                where.priority = priority;
            }

            if (type && type !== "ALL") {
                if (!types.includes(type)) {
                    return res.status(400).json({
                        message: "Некорректный фильтр типа"
                    });
                }

                where.type = type;
            }

            if (typeof search === "string" && search.trim()) {
                const query = search.trim();

                where.OR = [
                    {
                        title: {
                            contains: query,
                            mode: "insensitive"
                        }
                    },
                    {
                        description: {
                            contains: query,
                            mode: "insensitive"
                        }
                    },
                    {
                        property: {
                            name: {
                                contains: query,
                                mode: "insensitive"
                            }
                        }
                    },
                    {
                        tenant: {
                            fullName: {
                                contains: query,
                                mode: "insensitive"
                            }
                        }
                    }
                ];
            }

            const [requests, total, grouped] = await Promise.all([
                prisma.request.findMany({
                    where,
                    include: includeRequest,
                    orderBy: [
                        { createdAt: "desc" },
                        { id: "desc" }
                    ]
                }),

                prisma.request.count({ where }),

                prisma.request.groupBy({
                    by: ["status"],
                    where: { ownerId },
                    _count: { _all: true }
                })
            ]);

            const summary = {
                total,
                new: 0,
                inProgress: 0,
                waiting: 0,
                completed: 0,
                cancelled: 0
            };

            for (const group of grouped) {
                const count = group._count._all;

                if (group.status === "NEW") summary.new = count;
                if (group.status === "IN_PROGRESS") summary.inProgress = count;
                if (group.status === "WAITING") summary.waiting = count;
                if (group.status === "COMPLETED") summary.completed = count;
                if (group.status === "CANCELLED") summary.cancelled = count;
            }

            return res.json({
                requests,
                summary
            });
        } catch (error) {
            console.error("Ошибка получения заявок:", error);

            return res.status(500).json({
                message: "Не удалось загрузить заявки"
            });
        }
    });

    // GET /api/requests/:id
    router.get("/:id", authenticateToken, async (req, res) => {
        try {
            const ownerId = getOwnerId(req);
            const id = parseId(req.params.id);

            if (!id) {
                return res.status(400).json({
                    message: "Некорректный ID заявки"
                });
            }

            const request = await prisma.request.findFirst({
                where: { id, ownerId },
                include: includeRequest
            });

            if (!request) {
                return res.status(404).json({
                    message: "Заявка не найдена"
                });
            }

            return res.json(request);
        } catch (error) {
            console.error("Ошибка получения заявки:", error);

            return res.status(500).json({
                message: "Не удалось загрузить заявку"
            });
        }
    });

    // POST /api/requests
    router.post("/", authenticateToken, async (req, res) => {
        try {
            const ownerId = getOwnerId(req);

            if (!validateOwnerId(ownerId)) {
                return res.status(401).json({
                    message: "Не удалось определить пользователя"
                });
            }

            const errors = validateRequestBody(req.body);

            if (errors.length) {
                return res.status(400).json({
                    message: errors.join(". ")
                });
            }

            const propertyId = parseId(req.body.propertyId);

            if (!propertyId) {
                return res.status(400).json({
                    message: "Выберите объект недвижимости"
                });
            }

            const property = await prisma.property.findFirst({
                where: {
                    id: propertyId,
                    ownerId
                },
                select: {
                    id: true,
                    tenantId: true
                }
            });

            if (!property) {
                return res.status(404).json({
                    message: "Объект не найден"
                });
            }

            let tenantId = null;

            if (req.body.tenantId !== undefined && req.body.tenantId !== null) {
                tenantId = parseId(req.body.tenantId);

                const tenant = await prisma.tenant.findFirst({
                    where: {
                        id: tenantId,
                        ownerId
                    },
                    select: { id: true }
                });

                if (!tenant) {
                    return res.status(400).json({
                        message: "Арендатор не найден"
                    });
                }
            } else {
                tenantId = property.tenantId;
            }

            let assignedToId = null;

            if (
                req.body.assignedToId !== undefined &&
                req.body.assignedToId !== null
            ) {
                assignedToId = parseId(req.body.assignedToId);

                const assignee = await prisma.user.findUnique({
                    where: { id: assignedToId },
                    select: {
                        id: true,
                        role: true
                    }
                });

                if (
                    !assignee ||
                    !["OWNER", "MANAGER"].includes(assignee.role)
                ) {
                    return res.status(400).json({
                        message: "Ответственный пользователь не найден"
                    });
                }
            }

            const request = await prisma.request.create({
                data: {
                    title: req.body.title.trim(),
                    description: req.body.description.trim(),
                    type: req.body.type || "OTHER",
                    status: "NEW",
                    priority: req.body.priority || "NORMAL",
                    ownerId,
                    propertyId,
                    tenantId,
                    assignedToId
                },
                include: includeRequest
            });

            return res.status(201).json({
                message: "Заявка создана",
                request
            });
        } catch (error) {
            console.error("Ошибка создания заявки:", error);

            return res.status(500).json({
                message: "Не удалось создать заявку"
            });
        }
    });

    // PUT /api/requests/:id
    router.put("/:id", authenticateToken, async (req, res) => {
        try {
            const ownerId = getOwnerId(req);
            const id = parseId(req.params.id);

            if (!id) {
                return res.status(400).json({
                    message: "Некорректный ID заявки"
                });
            }

            const existing = await prisma.request.findFirst({
                where: { id, ownerId }
            });

            if (!existing) {
                return res.status(404).json({
                    message: "Заявка не найдена"
                });
            }

            const errors = validateRequestBody(req.body, true);

            if (errors.length) {
                return res.status(400).json({
                    message: errors.join(". ")
                });
            }

            const data = {};

            if (req.body.title !== undefined) {
                data.title = req.body.title.trim();
            }

            if (req.body.description !== undefined) {
                data.description = req.body.description.trim();
            }

            if (req.body.type !== undefined) {
                data.type = req.body.type;
            }

            if (req.body.priority !== undefined) {
                data.priority = req.body.priority;
            }

            if (req.body.status !== undefined) {
                data.status = req.body.status;

                data.completedAt = req.body.status === "COMPLETED"
                    ? new Date()
                    : null;
            }

            if (req.body.propertyId !== undefined) {
                const propertyId = parseId(req.body.propertyId);

                if (!propertyId) {
                    return res.status(400).json({
                        message: "Некорректный объект"
                    });
                }

                const property = await prisma.property.findFirst({
                    where: {
                        id: propertyId,
                        ownerId
                    },
                    select: {
                        id: true,
                        tenantId: true
                    }
                });

                if (!property) {
                    return res.status(400).json({
                        message: "Объект не найден"
                    });
                }

                data.propertyId = propertyId;

                if (req.body.tenantId === undefined) {
                    data.tenantId = property.tenantId;
                }
            }

            if (req.body.tenantId !== undefined) {
                if (req.body.tenantId === null) {
                    data.tenantId = null;
                } else {
                    const tenantId = parseId(req.body.tenantId);

                    const tenant = tenantId
                        ? await prisma.tenant.findFirst({
                            where: {
                                id: tenantId,
                                ownerId
                            },
                            select: { id: true }
                        })
                        : null;

                    if (!tenant) {
                        return res.status(400).json({
                            message: "Арендатор не найден"
                        });
                    }

                    data.tenantId = tenantId;
                }
            }

            if (req.body.assignedToId !== undefined) {
                if (req.body.assignedToId === null) {
                    data.assignedToId = null;
                } else {
                    const assignedToId = parseId(req.body.assignedToId);

                    const assignee = assignedToId
                        ? await prisma.user.findUnique({
                            where: { id: assignedToId },
                            select: {
                                id: true,
                                role: true
                            }
                        })
                        : null;

                    if (
                        !assignee ||
                        !["OWNER", "MANAGER"].includes(assignee.role)
                    ) {
                        return res.status(400).json({
                            message: "Ответственный пользователь не найден"
                        });
                    }

                    data.assignedToId = assignedToId;
                }
            }

            const request = await prisma.request.update({
                where: { id },
                data,
                include: includeRequest
            });

            return res.json({
                message: "Заявка обновлена",
                request
            });
        } catch (error) {
            console.error("Ошибка обновления заявки:", error);

            return res.status(500).json({
                message: "Не удалось обновить заявку"
            });
        }
    });

    // DELETE /api/requests/:id
    router.delete("/:id", authenticateToken, async (req, res) => {
        try {
            const ownerId = getOwnerId(req);
            const id = parseId(req.params.id);

            if (!id) {
                return res.status(400).json({
                    message: "Некорректный ID заявки"
                });
            }

            const existing = await prisma.request.findFirst({
                where: { id, ownerId },
                select: { id: true }
            });

            if (!existing) {
                return res.status(404).json({
                    message: "Заявка не найдена"
                });
            }

            await prisma.request.delete({
                where: { id }
            });

            return res.json({
                message: "Заявка удалена"
            });
        } catch (error) {
            console.error("Ошибка удаления заявки:", error);

            return res.status(500).json({
                message: "Не удалось удалить заявку"
            });
        }
    });

    return router;
}