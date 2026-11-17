import { Router } from "express";

export default function createMessagesRouter(
    prisma,
    authenticateToken
) {
    const router = Router();

    router.use(authenticateToken);

    async function getParticipant(conversationId, userId) {
        return prisma.conversationParticipant.findFirst({
            where: {
                conversationId,
                userId
            }
        });
    }

    router.get("/", async (req, res) => {
        try {
            const userId = Number(req.user.userId);

            const participants =
                await prisma.conversationParticipant.findMany({
                    where: { userId },
                    include: {
                        conversation: {
                            include: {
                                participants: {
                                    include: {
                                        user: {
                                            select: {
                                                id: true,
                                                name: true,
                                                email: true,
                                                role: true
                                            }
                                        }
                                    }
                                },
                                messages: {
                                    orderBy: { createdAt: "desc" },
                                    take: 1,
                                    include: {
                                        sender: {
                                            select: {
                                                id: true,
                                                name: true
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                });

            const conversations = participants
                .map((participant) => {
                    const conversation = participant.conversation;
                    const lastMessage = conversation.messages[0] || null;

                    const unreadCount = lastMessage
                        ? 0
                        : 0;

                    return {
                        id: conversation.id,
                        title: conversation.title,
                        createdAt: conversation.createdAt,
                        updatedAt: conversation.updatedAt,
                        participants: conversation.participants.map((item) => ({
                            id: item.user.id,
                            name: item.user.name,
                            email: item.user.email,
                            role: item.user.role
                        })),
                        lastMessage: lastMessage
                            ? {
                                id: lastMessage.id,
                                content: lastMessage.content,
                                type: lastMessage.type,
                                createdAt: lastMessage.createdAt,
                                sender: lastMessage.sender
                            }
                            : null,
                        unreadCount
                    };
                })
                .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

            res.json({ conversations });
        } catch (error) {
            console.error("Ошибка получения диалогов:", error);
            res.status(500).json({
                message: "Не удалось загрузить диалоги"
            });
        }
    });

    router.post("/conversations", async (req, res) => {
        try {
            const userId = Number(req.user.userId);
            const { participantIds, title, firstMessage } = req.body;

            if (
                !Array.isArray(participantIds) ||
                participantIds.length === 0
            ) {
                return res.status(400).json({
                    message: "Укажите участников диалога"
                });
            }

            const ids = [
                ...new Set(
                    participantIds
                        .map(Number)
                        .filter((id) => Number.isInteger(id) && id > 0)
                )
            ].filter((id) => id !== userId);

            if (ids.length === 0) {
                return res.status(400).json({
                    message: "Выберите другого пользователя"
                });
            }

            const users = await prisma.user.findMany({
                where: { id: { in: ids } },
                select: { id: true }
            });

            if (users.length !== ids.length) {
                return res.status(400).json({
                    message: "Один или несколько пользователей не найдены"
                });
            }

            const conversation = await prisma.$transaction(async (tx) => {
                const created = await tx.conversation.create({
                    data: {
                        title: typeof title === "string" && title.trim()
                            ? title.trim().slice(0, 150)
                            : null,
                        participants: {
                            create: [
                                { userId },
                                ...ids.map((id) => ({ userId: id }))
                            ]
                        }
                    }
                });

                if (
                    typeof firstMessage === "string" &&
                    firstMessage.trim()
                ) {
                    await tx.message.create({
                        data: {
                            conversationId: created.id,
                            senderId: userId,
                            content: firstMessage.trim().slice(0, 10000)
                        }
                    });

                    await tx.conversation.update({
                        where: { id: created.id },
                        data: { updatedAt: new Date() }
                    });
                }

                return tx.conversation.findUnique({
                    where: { id: created.id },
                    include: {
                        participants: {
                            include: {
                                user: {
                                    select: {
                                        id: true,
                                        name: true,
                                        email: true,
                                        role: true
                                    }
                                }
                            }
                        },
                        messages: {
                            orderBy: { createdAt: "asc" },
                            include: {
                                sender: {
                                    select: {
                                        id: true,
                                        name: true
                                    }
                                }
                            }
                        }
                    }
                });
            });

            res.status(201).json({
                message: "Диалог создан",
                conversation
            });
        } catch (error) {
            console.error("Ошибка создания диалога:", error);
            res.status(500).json({
                message: "Не удалось создать диалог"
            });
        }
    });

    router.get("/conversations/:id", async (req, res) => {
        try {
            const conversationId = Number(req.params.id);
            const userId = Number(req.user.userId);

            if (!Number.isInteger(conversationId) || conversationId <= 0) {
                return res.status(400).json({
                    message: "Некорректный ID диалога"
                });
            }

            const participant = await getParticipant(conversationId, userId);

            if (!participant) {
                return res.status(404).json({
                    message: "Диалог не найден"
                });
            }

            const messages = await prisma.message.findMany({
                where: { conversationId },
                orderBy: { createdAt: "asc" },
                include: {
                    sender: {
                        select: {
                            id: true,
                            name: true,
                            role: true
                        }
                    }
                }
            });

            res.json({ messages });
        } catch (error) {
            console.error("Ошибка получения сообщений:", error);
            res.status(500).json({
                message: "Не удалось загрузить сообщения"
            });
        }
    });

    router.post("/conversations/:id", async (req, res) => {
        try {
            const conversationId = Number(req.params.id);
            const userId = Number(req.user.userId);
            const content = typeof req.body.content === "string"
                ? req.body.content.trim()
                : "";

            if (!Number.isInteger(conversationId) || conversationId <= 0) {
                return res.status(400).json({
                    message: "Некорректный ID диалога"
                });
            }

            if (!content) {
                return res.status(400).json({
                    message: "Введите текст сообщения"
                });
            }

            if (content.length > 10000) {
                return res.status(400).json({
                    message: "Сообщение не должно превышать 10 000 символов"
                });
            }

            const participant = await getParticipant(conversationId, userId);

            if (!participant) {
                return res.status(404).json({
                    message: "Диалог не найден"
                });
            }

            const message = await prisma.$transaction(async (tx) => {
                const created = await tx.message.create({
                    data: {
                        conversationId,
                        senderId: userId,
                        content
                    },
                    include: {
                        sender: {
                            select: {
                                id: true,
                                name: true,
                                role: true
                            }
                        }
                    }
                });

                await tx.conversation.update({
                    where: { id: conversationId },
                    data: { updatedAt: new Date() }
                });

                return created;
            });

            res.status(201).json({
                message: "Сообщение отправлено",
                data: message
            });
        } catch (error) {
            console.error("Ошибка отправки сообщения:", error);
            res.status(500).json({
                message: "Не удалось отправить сообщение"
            });
        }
    });

    router.patch("/conversations/:id/read", async (req, res) => {
        try {
            const conversationId = Number(req.params.id);
            const userId = Number(req.user.userId);

            if (!Number.isInteger(conversationId) || conversationId <= 0) {
                return res.status(400).json({
                    message: "Некорректный ID диалога"
                });
            }

            const participant = await getParticipant(conversationId, userId);

            if (!participant) {
                return res.status(404).json({
                    message: "Диалог не найден"
                });
            }

            await prisma.conversationParticipant.update({
                where: {
                    conversationId_userId: {
                        conversationId,
                        userId
                    }
                },
                data: {
                    lastReadAt: new Date()
                }
            });

            res.json({
                message: "Диалог отмечен прочитанным"
            });
        } catch (error) {
            console.error("Ошибка отметки прочтения:", error);
            res.status(500).json({
                message: "Не удалось отметить диалог прочитанным"
            });
        }
    });

    router.get("/users", async (req, res) => {
        try {
            const userId = Number(req.user.userId);

            const users = await prisma.user.findMany({
                where: {
                    id: { not: userId }
                },
                orderBy: { name: "asc" },
                select: {
                    id: true,
                    name: true,
                    email: true,
                    role: true
                }
            });

            res.json({ users });
        } catch (error) {
            console.error("Ошибка получения пользователей:", error);
            res.status(500).json({
                message: "Не удалось загрузить пользователей"
            });
        }
    });

    return router;
}