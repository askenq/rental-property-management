import "dotenv/config";

import express from "express";
import cors from "cors";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import path from "path";
import createPaymentsRouter from "./routes/payments.js";
import createRequestsRouter from "./routes/requests.js";
import createMessagesRouter from "./routes/messages.js";
import createAnalyticsRouter from "./routes/analytics.js";
import { fileURLToPath } from "url";

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";


const app = express();

const PORT = 3000;

const JWT_SECRET = process.env.JWT_SECRET;

const __filename =
    fileURLToPath(import.meta.url);

const __dirname =
    path.dirname(__filename);

const clientPath =
    path.join(__dirname, "..", "client");

if (!JWT_SECRET) {

    console.error(
        "Ошибка: JWT_SECRET не найден в .env"
    );

    process.exit(1);

}


if (!process.env.DATABASE_URL) {

    console.error(
        "Ошибка: DATABASE_URL не найден в .env"
    );

    process.exit(1);

}

const adapter = new PrismaPg({

    connectionString:
        process.env.DATABASE_URL

});


const prisma = new PrismaClient({

    adapter

});

app.use(cors());

app.use(express.json());

app.use(
    express.static(clientPath)
);

app.get(
    "/",
    (req, res) => {

        res.sendFile(
            path.join(
                clientPath,
                "index.html"
            )
        );

    }
);

app.post(
    "/api/auth/register",
    async (req, res) => {

        try {

            const {
                name,
                email,
                password,
                role
            } = req.body;


            if (
                !name ||
                !email ||
                !password ||
                !role
            ) {

                return res.status(400).json({

                    message:
                        "Заполните все поля"

                });

            }


            const allowedRoles = [

                "OWNER",
                "MANAGER",
                "TENANT"

            ];


            if (
                !allowedRoles.includes(role)
            ) {

                return res.status(400).json({

                    message:
                        "Некорректная роль пользователя"

                });

            }


            if (
                password.length < 6
            ) {

                return res.status(400).json({

                    message:
                        "Пароль должен содержать минимум 6 символов"

                });

            }


            const normalizedEmail =
                email
                    .trim()
                    .toLowerCase();


            const existingUser =
                await prisma.user.findUnique({

                    where: {

                        email:
                            normalizedEmail

                    }

                });


            if (existingUser) {

                return res.status(409).json({

                    message:
                        "Пользователь с таким email уже существует"

                });

            }


            const passwordHash =
                await bcrypt.hash(
                    password,
                    10
                );


            const user =
                await prisma.user.create({

                    data: {

                        name:
                            name.trim(),

                        email:
                            normalizedEmail,

                        passwordHash,

                        role

                    },

                    select: {

                        id: true,
                        name: true,
                        email: true,
                        role: true,
                        createdAt: true

                    }

                });


            const token =
                jwt.sign(

                    {

                        userId:
                            user.id,

                        role:
                            user.role

                    },

                    JWT_SECRET,

                    {

                        expiresIn:
                            "7d"

                    }

                );


            res.status(201).json({

                message:
                    "Регистрация выполнена успешно",

                user,

                token

            });

        } catch (error) {

            console.error(
                "Ошибка регистрации:",
                error
            );


            res.status(500).json({

                message:
                    "Ошибка сервера"

            });

        }

    }
);

app.post(
    "/api/auth/login",
    async (req, res) => {

        try {

            const {
                email,
                password
            } = req.body;


            if (
                !email ||
                !password
            ) {

                return res.status(400).json({

                    message:
                        "Введите email и пароль"

                });

            }


            const normalizedEmail =
                email
                    .trim()
                    .toLowerCase();


            const user =
                await prisma.user.findUnique({

                    where: {

                        email:
                            normalizedEmail

                    }

                });


            if (!user) {

                return res.status(401).json({

                    message:
                        "Неверный email или пароль"

                });

            }


            if (!user.passwordHash) {

                return res.status(401).json({

                    message:
                        "Для пользователя не установлен пароль"

                });

            }


            const passwordIsValid =
                await bcrypt.compare(

                    password,

                    user.passwordHash

                );


            if (!passwordIsValid) {

                return res.status(401).json({

                    message:
                        "Неверный email или пароль"

                });

            }


            const token =
                jwt.sign(

                    {

                        userId:
                            user.id,

                        role:
                            user.role

                    },

                    JWT_SECRET,

                    {

                        expiresIn:
                            "7d"

                    }

                );


            res.json({

                message:
                    "Вход выполнен успешно",

                user: {

                    id:
                        user.id,

                    name:
                        user.name,

                    email:
                        user.email,

                    role:
                        user.role,

                    createdAt:
                        user.createdAt

                },

                token

            });

        } catch (error) {

            console.error(
                "Ошибка входа:",
                error
            );


            res.status(500).json({

                message:
                    "Ошибка сервера"

            });

        }

    }
);

function authenticateToken(
    req,
    res,
    next
) {

    const authHeader =
        req.headers.authorization;


    if (!authHeader) {

        return res.status(401).json({

            message:
                "Требуется авторизация"

        });

    }


    const parts =
        authHeader.split(" ");


    if (
        parts.length !== 2 ||
        parts[0] !== "Bearer"
    ) {

        return res.status(401).json({

            message:
                "Некорректный формат токена"

        });

    }


    const token =
        parts[1];


    try {

        const decoded =
            jwt.verify(
                token,
                JWT_SECRET
            );


        req.user =
            decoded;


        next();

    } catch (error) {

        return res.status(401).json({

            message:
                "Недействительный или просроченный токен"

        });

    }

}

app.get(
    "/api/auth/me",
    authenticateToken,
    async (req, res) => {

        try {

            const user =
                await prisma.user.findUnique({

                    where: {

                        id:
                            req.user.userId

                    },

                    select: {

                        id: true,
                        name: true,
                        email: true,
                        role: true,
                        createdAt: true

                    }

                });


            if (!user) {

                return res.status(404).json({

                    message:
                        "Пользователь не найден"

                });

            }


            res.json({

                user

            });

        } catch (error) {

            console.error(
                "Ошибка получения пользователя:",
                error
            );


            res.status(500).json({

                message:
                    "Ошибка сервера"

            });

        }

    }
);

app.get(
    "/api/users",
    authenticateToken,
    async (req, res) => {

        try {

            const users =
                await prisma.user.findMany({

                    orderBy: {

                        id:
                            "asc"

                    },

                    select: {

                        id: true,
                        name: true,
                        email: true,
                        role: true,
                        createdAt: true

                    }

                });


            res.json(users);

        } catch (error) {

            console.error(
                "Ошибка получения пользователей:",
                error
            );


            res.status(500).json({

                message:
                    "Ошибка при получении пользователей"

            });

        }

    }
);

app.get(
    "/api/properties",
    authenticateToken,
    async (req, res) => {

        try {

            const properties =
                await prisma.property.findMany({

                    where: {

                        ownerId:
                            req.user.userId

                    },

                    orderBy: {

                        id:
                            "asc"

                    },

                    include: {

                        tenant: {

                            select: {

                                id: true,

                                fullName: true,

                                email: true,

                                phone: true,

                                status: true

                            }

                        }

                    }

                });


            res.json(properties);

        } catch (error) {

            console.error(
                "Ошибка получения объектов:",
                error
            );


            res.status(500).json({

                message:
                    "Ошибка при получении объектов"

            });

        }

    }
);

app.get(
    "/api/properties/:id",
    authenticateToken,
    async (req, res) => {

        try {

            const id =
                Number(
                    req.params.id
                );


            if (
                Number.isNaN(id)
            ) {

                return res.status(400).json({

                    message:
                        "Некорректный ID объекта"

                });

            }


            const property =
                await prisma.property.findFirst({

                    where: {

                        id,

                        ownerId:
                            req.user.userId

                    },

                    include: {

                        tenant: {

                            select: {

                                id: true,

                                fullName: true,

                                email: true,

                                phone: true,

                                passportSeries: true,

                                passportNumber: true,

                                passportIssuedAt: true,

                                status: true,

                                notes: true

                            }

                        }

                    }

                });


            if (!property) {

                return res.status(404).json({

                    message:
                        "Объект не найден"

                });

            }


            res.json(property);

        } catch (error) {

            console.error(
                "Ошибка получения объекта:",
                error
            );


            res.status(500).json({

                message:
                    "Ошибка сервера"

            });

        }

    }
);

app.post(
    "/api/properties",
    authenticateToken,
    async (req, res) => {

        try {

            const {

                name,
                address,
                type,
                area,
                rooms,
                floor,
                rent,
                status,
                tenantName

            } = req.body;


            if (
                !name ||
                !address ||
                !type ||
                area === undefined ||
                rooms === undefined ||
                floor === undefined ||
                rent === undefined ||
                !status
            ) {

                return res.status(400).json({

                    message:
                        "Заполните все обязательные поля"

                });

            }


            const allowedTypes = [

                "APARTMENT",
                "HOUSE",
                "COMMERCIAL"

            ];


            const allowedStatuses = [

                "RENTED",
                "AVAILABLE",
                "MAINTENANCE"

            ];


            if (
                !allowedTypes.includes(type)
            ) {

                return res.status(400).json({

                    message:
                        "Некорректный тип недвижимости"

                });

            }


            if (
                !allowedStatuses.includes(status)
            ) {

                return res.status(400).json({

                    message:
                        "Некорректный статус объекта"

                });

            }


            const property =
                await prisma.property.create({

                    data: {

                        name:
                            name.trim(),

                        address:
                            address.trim(),

                        type,

                        area:
                            Number(area),

                        rooms:
                            Number(rooms),

                        floor:
                            Number(floor),

                        rent:
                            Number(rent),

                        status,

                        tenantName:
                            tenantName
                                ? tenantName.trim()
                                : null,

                        ownerId:
                            req.user.userId

                    }

                });


            res.status(201).json({

                message:
                    "Объект успешно добавлен",

                property

            });

        } catch (error) {

            console.error(
                "Ошибка создания объекта:",
                error
            );


            res.status(500).json({

                message:
                    "Ошибка при создании объекта"

            });

        }

    }
);

app.put(
    "/api/properties/:id",
    authenticateToken,
    async (req, res) => {

        try {

            const id =
                Number(
                    req.params.id
                );


            if (
                Number.isNaN(id)
            ) {

                return res.status(400).json({

                    message:
                        "Некорректный ID объекта"

                });

            }


            const existingProperty =
                await prisma.property.findFirst({

                    where: {

                        id,

                        ownerId:
                            req.user.userId

                    }

                });


            if (!existingProperty) {

                return res.status(404).json({

                    message:
                        "Объект не найден"

                });

            }


            const {

                name,
                address,
                type,
                area,
                rooms,
                floor,
                rent,
                status,
                tenantName

            } = req.body;


            const allowedTypes = [

                "APARTMENT",
                "HOUSE",
                "COMMERCIAL"

            ];


            const allowedStatuses = [

                "RENTED",
                "AVAILABLE",
                "MAINTENANCE"

            ];


            if (
                type &&
                !allowedTypes.includes(type)
            ) {

                return res.status(400).json({

                    message:
                        "Некорректный тип недвижимости"

                });

            }


            if (
                status &&
                !allowedStatuses.includes(status)
            ) {

                return res.status(400).json({

                    message:
                        "Некорректный статус объекта"

                });

            }


            const property =
                await prisma.property.update({

                    where: {

                        id

                    },

                    data: {

                        ...(name !== undefined && {

                            name:
                                name.trim()

                        }),

                        ...(address !== undefined && {

                            address:
                                address.trim()

                        }),

                        ...(type !== undefined && {

                            type

                        }),

                        ...(area !== undefined && {

                            area:
                                Number(area)

                        }),

                        ...(rooms !== undefined && {

                            rooms:
                                Number(rooms)

                        }),

                        ...(floor !== undefined && {

                            floor:
                                Number(floor)

                        }),

                        ...(rent !== undefined && {

                            rent:
                                Number(rent)

                        }),

                        ...(status !== undefined && {

                            status

                        }),

                        ...(tenantName !== undefined && {

                            tenantName:
                                tenantName
                                    ? tenantName.trim()
                                    : null

                        })

                    }

                });


            res.json({

                message:
                    "Объект успешно обновлён",

                property

            });

        } catch (error) {

            console.error(
                "Ошибка изменения объекта:",
                error
            );


            res.status(500).json({

                message:
                    "Ошибка при изменении объекта"

            });

        }

    }
);

app.delete(
    "/api/properties/:id",
    authenticateToken,
    async (req, res) => {

        try {

            const id =
                Number(
                    req.params.id
                );


            if (
                Number.isNaN(id)
            ) {

                return res.status(400).json({

                    message:
                        "Некорректный ID объекта"

                });

            }


            const existingProperty =
                await prisma.property.findFirst({

                    where: {

                        id,

                        ownerId:
                            req.user.userId

                    }

                });


            if (!existingProperty) {

                return res.status(404).json({

                    message:
                        "Объект не найден"

                });

            }


            await prisma.property.delete({

                where: {

                    id

                }

            });


            res.json({

                message:
                    "Объект успешно удалён"

            });

        } catch (error) {

            console.error(
                "Ошибка удаления объекта:",
                error
            );


            res.status(500).json({

                message:
                    "Ошибка при удалении объекта"

            });

        }

    }
);

app.get(
    "/api/tenants",
    authenticateToken,
    async (req, res) => {

        try {

            const tenants =
                await prisma.tenant.findMany({

                    where: {

                        ownerId:
                            req.user.userId

                    },

                    orderBy: {

                        id:
                            "desc"

                    },

                    include: {

                        properties: {

                            select: {

                                id: true,

                                name: true,

                                address: true,

                                type: true,

                                rent: true,

                                status: true

                            }

                        }

                    }

                });


            res.json(tenants);

        } catch (error) {

            console.error(
                "Ошибка получения арендаторов:",
                error
            );


            res.status(500).json({

                message:
                    "Ошибка при получении арендаторов"

            });

        }

    }
);

app.get(
    "/api/tenants/:id",
    authenticateToken,
    async (req, res) => {

        try {

            const id =
                Number(
                    req.params.id
                );


            if (
                Number.isNaN(id)
            ) {

                return res.status(400).json({

                    message:
                        "Некорректный ID арендатора"

                });

            }


            const tenant =
                await prisma.tenant.findFirst({

                    where: {

                        id,

                        ownerId:
                            req.user.userId

                    },

                    include: {

                        properties: {

                            select: {

                                id: true,

                                name: true,

                                address: true,

                                type: true,

                                rent: true,

                                status: true

                            }

                        }

                    }

                });


            if (!tenant) {

                return res.status(404).json({

                    message:
                        "Арендатор не найден"

                });

            }


            res.json(tenant);

        } catch (error) {

            console.error(
                "Ошибка получения арендатора:",
                error
            );


            res.status(500).json({

                message:
                    "Ошибка сервера"

            });

        }

    }
);

app.post(
    "/api/tenants",
    authenticateToken,
    async (req, res) => {

        try {

            const {

                fullName,
                email,
                phone,
                passportSeries,
                passportNumber,
                passportIssuedAt,
                status,
                notes,
                propertyId

            } = req.body;


            if (
                !fullName ||
                !fullName.trim()
            ) {

                return res.status(400).json({

                    message:
                        "Введите ФИО арендатора"

                });

            }


            if (
                email &&
                !/^[^\s@]+@[^\s@]+\.[^\s@]+$/
                    .test(email.trim())
            ) {

                return res.status(400).json({

                    message:
                        "Введите корректный email"

                });

            }


            const allowedStatuses = [

                "ACTIVE",
                "INACTIVE"

            ];


            const tenantStatus =
                status ||
                "ACTIVE";


            if (
                !allowedStatuses.includes(
                    tenantStatus
                )
            ) {

                return res.status(400).json({

                    message:
                        "Некорректный статус арендатора"

                });

            }


            let parsedPassportDate =
                null;


            if (
                passportIssuedAt
            ) {

                const date =
                    new Date(
                        `${passportIssuedAt}T00:00:00`
                    );


                if (
                    Number.isNaN(
                        date.getTime()
                    )
                ) {

                    return res.status(400).json({

                        message:
                            "Некорректная дата выдачи паспорта"

                    });

                }


                const currentYear =
                    new Date().getFullYear();


                const year =
                    date.getFullYear();


                if (
                    year < 1900 ||
                    year > currentYear
                ) {

                    return res.status(400).json({

                        message:
                            "Некорректный год выдачи паспорта"

                    });

                }


                parsedPassportDate =
                    date;

            }


            let property =
                null;


            if (
                propertyId !== undefined &&
                propertyId !== null &&
                propertyId !== ""
            ) {

                const numericPropertyId =
                    Number(
                        propertyId
                    );


                if (
                    Number.isNaN(
                        numericPropertyId
                    )
                ) {

                    return res.status(400).json({

                        message:
                            "Некорректный ID объекта"

                    });

                }


                property =
                    await prisma.property.findFirst({

                        where: {

                            id:
                                numericPropertyId,

                            ownerId:
                                req.user.userId

                        }

                    });


                if (!property) {

                    return res.status(404).json({

                        message:
                            "Объект не найден"

                    });

                }


                if (
                    property.tenantId
                ) {

                    return res.status(409).json({

                        message:
                            "Этот объект уже закреплён за другим арендатором"

                    });

                }

            }


            const tenant =
                await prisma.$transaction(
                    async (tx) => {

                        const createdTenant =
                            await tx.tenant.create({

                                data: {

                                    fullName:
                                        fullName.trim(),

                                    email:
                                        email
                                            ? email
                                                .trim()
                                                .toLowerCase()
                                            : null,

                                    phone:
                                        phone
                                            ? phone.trim()
                                            : null,

                                    passportSeries:
                                        passportSeries
                                            ? passportSeries.trim()
                                            : null,

                                    passportNumber:
                                        passportNumber
                                            ? passportNumber.trim()
                                            : null,

                                    passportIssuedAt:
                                        parsedPassportDate,

                                    status:
                                        tenantStatus,

                                    notes:
                                        notes
                                            ? notes.trim()
                                            : null,

                                    ownerId:
                                        req.user.userId

                                }

                            });


                        if (property) {

                            await tx.property.update({

                                where: {

                                    id:
                                        property.id

                                },

                                data: {

                                    tenantId:
                                        createdTenant.id,

                                    tenantName:
                                        createdTenant.fullName,

                                    status:
                                        "RENTED"

                                }

                            });

                        }


                        return createdTenant;

                    }
                );


            res.status(201).json({

                message:
                    "Арендатор успешно добавлен",

                tenant

            });

        } catch (error) {

            console.error(
                "Ошибка создания арендатора:",
                error
            );


            res.status(500).json({

                message:
                    "Ошибка при создании арендатора"

            });

        }

    }
);

app.put(
    "/api/tenants/:id",
    authenticateToken,
    async (req, res) => {

        try {

            const id =
                Number(
                    req.params.id
                );


            if (
                Number.isNaN(id)
            ) {

                return res.status(400).json({

                    message:
                        "Некорректный ID арендатора"

                });

            }


            const existingTenant =
                await prisma.tenant.findFirst({

                    where: {

                        id,

                        ownerId:
                            req.user.userId

                    },

                    include: {

                        properties: true

                    }

                });


            if (!existingTenant) {

                return res.status(404).json({

                    message:
                        "Арендатор не найден"

                });

            }


            const {

                fullName,
                email,
                phone,
                passportSeries,
                passportNumber,
                passportIssuedAt,
                status,
                notes,
                propertyId

            } = req.body;


            if (
                fullName !== undefined &&
                !fullName.trim()
            ) {

                return res.status(400).json({

                    message:
                        "ФИО не может быть пустым"

                });

            }


            if (
                email &&
                !/^[^\s@]+@[^\s@]+\.[^\s@]+$/
                    .test(email.trim())
            ) {

                return res.status(400).json({

                    message:
                        "Введите корректный email"

                });

            }


            const allowedStatuses = [

                "ACTIVE",
                "INACTIVE"

            ];


            if (
                status !== undefined &&
                !allowedStatuses.includes(
                    status
                )
            ) {

                return res.status(400).json({

                    message:
                        "Некорректный статус арендатора"

                });

            }


            let parsedPassportDate =
                undefined;


            if (
                passportIssuedAt !== undefined
            ) {

                if (
                    passportIssuedAt === null ||
                    passportIssuedAt === ""
                ) {

                    parsedPassportDate =
                        null;

                } else {

                    const date =
                        new Date(
                            `${passportIssuedAt}T00:00:00`
                        );


                    if (
                        Number.isNaN(
                            date.getTime()
                        )
                    ) {

                        return res.status(400).json({

                            message:
                                "Некорректная дата выдачи паспорта"

                        });

                    }


                    const currentYear =
                        new Date().getFullYear();


                    const year =
                        date.getFullYear();


                    if (
                        year < 1900 ||
                        year > currentYear
                    ) {

                        return res.status(400).json({

                            message:
                                "Некорректный год выдачи паспорта"

                        });

                    }


                    parsedPassportDate =
                        date;

                }

            }


            let newProperty =
                undefined;


            if (
                propertyId !== undefined
            ) {

                if (
                    propertyId !== null &&
                    propertyId !== ""
                ) {

                    const numericPropertyId =
                        Number(
                            propertyId
                        );


                    if (
                        Number.isNaN(
                            numericPropertyId
                        )
                    ) {

                        return res.status(400).json({

                            message:
                                "Некорректный ID объекта"

                        });

                    }


                    newProperty =
                        await prisma.property.findFirst({

                            where: {

                                id:
                                    numericPropertyId,

                                ownerId:
                                    req.user.userId

                            }

                        });


                    if (!newProperty) {

                        return res.status(404).json({

                            message:
                                "Объект не найден"

                        });

                    }


                    if (
                        newProperty.tenantId &&
                        newProperty.tenantId !== id
                    ) {

                        return res.status(409).json({

                            message:
                                "Этот объект уже закреплён за другим арендатором"

                        });

                    }

                } else {

                    newProperty =
                        null;

                }

            }


            const updatedTenant =
                await prisma.$transaction(
                    async (tx) => {

                        if (
                            propertyId !== undefined
                        ) {

                            for (
                                const oldProperty
                                of existingTenant.properties
                            ) {

                                await tx.property.update({

                                    where: {

                                        id:
                                            oldProperty.id

                                    },

                                    data: {

                                        tenantId:
                                            null,

                                        tenantName:
                                            null,

                                        status:
                                            "AVAILABLE"

                                    }

                                });

                            }


                            if (
                                newProperty
                            ) {

                                await tx.property.update({

                                    where: {

                                        id:
                                            newProperty.id

                                    },

                                    data: {

                                        tenantId:
                                            id,

                                        tenantName:
                                            fullName !== undefined
                                                ? fullName.trim()
                                                : existingTenant.fullName,

                                        status:
                                            "RENTED"

                                    }

                                });

                            }

                        }


                        const tenant =
                            await tx.tenant.update({

                                where: {

                                    id

                                },

                                data: {

                                    ...(fullName !== undefined && {

                                        fullName:
                                            fullName.trim()

                                    }),

                                    ...(email !== undefined && {

                                        email:
                                            email
                                                ? email
                                                    .trim()
                                                    .toLowerCase()
                                                : null

                                    }),

                                    ...(phone !== undefined && {

                                        phone:
                                            phone
                                                ? phone.trim()
                                                : null

                                    }),

                                    ...(passportSeries !== undefined && {

                                        passportSeries:
                                            passportSeries
                                                ? passportSeries.trim()
                                                : null

                                    }),

                                    ...(passportNumber !== undefined && {

                                        passportNumber:
                                            passportNumber
                                                ? passportNumber.trim()
                                                : null

                                    }),

                                    ...(passportIssuedAt !== undefined && {

                                        passportIssuedAt:
                                            parsedPassportDate

                                    }),

                                    ...(status !== undefined && {

                                        status

                                    }),

                                    ...(notes !== undefined && {

                                        notes:
                                            notes
                                                ? notes.trim()
                                                : null

                                    })

                                }

                            });


                        if (
                            fullName !== undefined
                        ) {

                            await tx.property.updateMany({

                                where: {

                                    tenantId:
                                        id

                                },

                                data: {

                                    tenantName:
                                        fullName.trim()

                                }

                            });

                        }


                        return tenant;

                    }
                );


            res.json({

                message:
                    "Арендатор успешно обновлён",

                tenant:
                    updatedTenant

            });

        } catch (error) {

            console.error(
                "Ошибка изменения арендатора:",
                error
            );


            res.status(500).json({

                message:
                    "Ошибка при изменении арендатора"

            });

        }

    }
);

app.delete(
    "/api/tenants/:id",
    authenticateToken,
    async (req, res) => {

        try {

            const id =
                Number(
                    req.params.id
                );


            if (
                Number.isNaN(id)
            ) {

                return res.status(400).json({

                    message:
                        "Некорректный ID арендатора"

                });

            }


            const tenant =
                await prisma.tenant.findFirst({

                    where: {

                        id,

                        ownerId:
                            req.user.userId

                    },

                    include: {

                        properties: true

                    }

                });


            if (!tenant) {

                return res.status(404).json({

                    message:
                        "Арендатор не найден"

                });

            }


            await prisma.$transaction(
                async (tx) => {

                    for (
                        const property
                        of tenant.properties
                    ) {

                        await tx.property.update({

                            where: {

                                id:
                                    property.id

                            },

                            data: {

                                tenantId:
                                    null,

                                tenantName:
                                    null,

                                status:
                                    "AVAILABLE"

                            }

                        });

                    }


                    await tx.tenant.delete({

                        where: {

                            id

                        }

                    });

                }
            );


            res.json({

                message:
                    "Арендатор успешно удалён"

            });

        } catch (error) {

            console.error(
                "Ошибка удаления арендатора:",
                error
            );


            res.status(500).json({

                message:
                    "Ошибка при удалении арендатора"

            });

        }

    }
);

app.get(
    "/api/contracts",
    authenticateToken,
    async (req, res) => {

        try {

            const contracts =
                await prisma.contract.findMany({

                    where: {

                        ownerId:
                            req.user.userId

                    },

                    orderBy: {

                        id:
                            "desc"

                    },

                    include: {

                        property: {

                            select: {

                                id: true,

                                name: true,

                                address: true,

                                type: true,

                                rent: true,

                                status: true

                            }

                        },

                        tenant: {

                            select: {

                                id: true,

                                fullName: true,

                                email: true,

                                phone: true,

                                status: true

                            }

                        }

                    }

                });


            res.json(contracts);

        } catch (error) {

            console.error(
                "Ошибка получения договоров:",
                error
            );


            res.status(500).json({

                message:
                    "Ошибка при получении договоров"

            });

        }

    }
);

app.get(
    "/api/contracts/:id",
    authenticateToken,
    async (req, res) => {

        try {

            const id =
                Number(
                    req.params.id
                );


            if (
                Number.isNaN(id)
            ) {

                return res.status(400).json({

                    message:
                        "Некорректный ID договора"

                });

            }


            const contract =
                await prisma.contract.findFirst({

                    where: {

                        id,

                        ownerId:
                            req.user.userId

                    },

                    include: {

                        property: {

                            select: {

                                id: true,

                                name: true,

                                address: true,

                                type: true,

                                area: true,

                                rooms: true,

                                floor: true,

                                rent: true,

                                status: true

                            }

                        },

                        tenant: {

                            select: {

                                id: true,

                                fullName: true,

                                email: true,

                                phone: true,

                                passportSeries: true,

                                passportNumber: true,

                                passportIssuedAt: true,

                                status: true,

                                notes: true

                            }

                        }

                    }

                });


            if (!contract) {

                return res.status(404).json({

                    message:
                        "Договор не найден"

                });

            }


            res.json(contract);

        } catch (error) {

            console.error(
                "Ошибка получения договора:",
                error
            );


            res.status(500).json({

                message:
                    "Ошибка сервера"

            });

        }

    }
);

app.post(
    "/api/contracts",
    authenticateToken,
    async (req, res) => {

        try {

            const {

                number,
                startDate,
                endDate,
                rent,
                deposit,
                paymentDay,
                status,
                notes,
                propertyId,
                tenantId

            } = req.body;


            if (
                !number ||
                !number.trim()
            ) {

                return res.status(400).json({

                    message:
                        "Введите номер договора"

                });

            }


            if (!startDate) {

                return res.status(400).json({

                    message:
                        "Укажите дату начала договора"

                });

            }


            if (!endDate) {

                return res.status(400).json({

                    message:
                        "Укажите дату окончания договора"

                });

            }


            if (
                rent === undefined ||
                rent === null ||
                rent === ""
            ) {

                return res.status(400).json({

                    message:
                        "Укажите стоимость аренды"

                });

            }


            if (
                propertyId === undefined ||
                propertyId === null ||
                propertyId === ""
            ) {

                return res.status(400).json({

                    message:
                        "Выберите объект"

                });

            }


            if (
                tenantId === undefined ||
                tenantId === null ||
                tenantId === ""
            ) {

                return res.status(400).json({

                    message:
                        "Выберите арендатора"

                });

            }

            const contractNumber =
                number.trim();


            const existingContract =
                await prisma.contract.findFirst({

                    where: {

                        ownerId:
                            req.user.userId,

                        number:
                            contractNumber

                    }

                });


            if (existingContract) {

                return res.status(409).json({

                    message:
                        "Договор с таким номером уже существует"

                });

            }

            const parsedStartDate =
                new Date(
                    `${startDate}T00:00:00`
                );


            const parsedEndDate =
                new Date(
                    `${endDate}T00:00:00`
                );


            if (
                Number.isNaN(
                    parsedStartDate.getTime()
                ) ||
                Number.isNaN(
                    parsedEndDate.getTime()
                )
            ) {

                return res.status(400).json({

                    message:
                        "Некорректная дата договора"

                });

            }


            if (
                parsedEndDate <
                parsedStartDate
            ) {

                return res.status(400).json({

                    message:
                        "Дата окончания не может быть раньше даты начала"

                });

            }

            const numericRent =
                Number(rent);


            const numericDeposit =
                deposit === undefined ||
                deposit === null ||
                deposit === ""
                    ? null
                    : Number(deposit);


            if (
                !Number.isFinite(
                    numericRent
                ) ||
                numericRent < 0
            ) {

                return res.status(400).json({

                    message:
                        "Некорректная стоимость аренды"

                });

            }


            if (
                numericDeposit !== null &&
                (
                    !Number.isFinite(
                        numericDeposit
                    ) ||
                    numericDeposit < 0
                )
            ) {

                return res.status(400).json({

                    message:
                        "Некорректная сумма депозита"

                });

            }

            let numericPaymentDay =
                null;


            if (
                paymentDay !== undefined &&
                paymentDay !== null &&
                paymentDay !== ""
            ) {

                numericPaymentDay =
                    Number(paymentDay);


                if (
                    !Number.isInteger(
                        numericPaymentDay
                    ) ||
                    numericPaymentDay < 1 ||
                    numericPaymentDay > 31
                ) {

                    return res.status(400).json({

                        message:
                            "День оплаты должен быть от 1 до 31"

                    });

                }

            }

            const allowedStatuses = [

                "DRAFT",
                "ACTIVE",
                "EXPIRED",
                "TERMINATED"

            ];


            const contractStatus =
                status ||
                "DRAFT";


            if (
                !allowedStatuses.includes(
                    contractStatus
                )
            ) {

                return res.status(400).json({

                    message:
                        "Некорректный статус договора"

                });

            }

            const property =
                await prisma.property.findFirst({

                    where: {

                        id:
                            Number(propertyId),

                        ownerId:
                            req.user.userId

                    }

                });


            if (!property) {

                return res.status(404).json({

                    message:
                        "Объект не найден"

                });

            }

            const tenant =
                await prisma.tenant.findFirst({

                    where: {

                        id:
                            Number(tenantId),

                        ownerId:
                            req.user.userId

                    }

                });


            if (!tenant) {

                return res.status(404).json({

                    message:
                        "Арендатор не найден"

                });

            }

            const contract =
                await prisma.$transaction(
                    async (tx) => {

                        const createdContract =
                            await tx.contract.create({

                                data: {

                                    number:
                                        contractNumber,

                                    startDate:
                                        parsedStartDate,

                                    endDate:
                                        parsedEndDate,

                                    rent:
                                        numericRent,

                                    deposit:
                                        numericDeposit,

                                    paymentDay:
                                        numericPaymentDay,

                                    status:
                                        contractStatus,

                                    notes:
                                        notes
                                            ? notes.trim()
                                            : null,

                                    ownerId:
                                        req.user.userId,

                                    propertyId:
                                        Number(propertyId),

                                    tenantId:
                                        Number(tenantId)

                                },

                                include: {

                                    property: true,

                                    tenant: true

                                }

                            });

                        if (
                            contractStatus === "ACTIVE"
                        ) {

                            await tx.property.update({

                                where: {

                                    id:
                                        Number(propertyId)

                                },

                                data: {

                                    status:
                                        "RENTED",

                                    tenantId:
                                        Number(tenantId),

                                    tenantName:
                                        tenant.fullName

                                }

                            });

                        }


                        return createdContract;

                    }
                );


            res.status(201).json({

                message:
                    "Договор успешно создан",

                contract

            });

        } catch (error) {

            console.error(
                "Ошибка создания договора:",
                error
            );


            if (
                error?.code ===
                "P2002"
            ) {

                return res.status(409).json({

                    message:
                        "Договор с таким номером уже существует"

                });

            }


            res.status(500).json({

                message:
                    "Ошибка при создании договора"

            });

        }

    }
);

app.put(
    "/api/contracts/:id",
    authenticateToken,
    async (req, res) => {

        try {

            const id =
                Number(
                    req.params.id
                );


            if (
                Number.isNaN(id)
            ) {

                return res.status(400).json({

                    message:
                        "Некорректный ID договора"

                });

            }


            const existingContract =
                await prisma.contract.findFirst({

                    where: {

                        id,

                        ownerId:
                            req.user.userId

                    }

                });


            if (!existingContract) {

                return res.status(404).json({

                    message:
                        "Договор не найден"

                });

            }


            const {

                number,
                startDate,
                endDate,
                rent,
                deposit,
                paymentDay,
                status,
                notes,
                propertyId,
                tenantId

            } = req.body;

            if (
                number !== undefined &&
                !number.trim()
            ) {

                return res.status(400).json({

                    message:
                        "Номер договора не может быть пустым"

                });

            }


            const newNumber =
                number !== undefined
                    ? number.trim()
                    : existingContract.number;


            if (
                number !== undefined
            ) {

                const duplicate =
                    await prisma.contract.findFirst({

                        where: {

                            ownerId:
                                req.user.userId,

                            number:
                                newNumber,

                            NOT: {

                                id

                            }

                        }

                    });


                if (duplicate) {

                    return res.status(409).json({

                        message:
                            "Договор с таким номером уже существует"

                    });

                }

            }

            let newStartDate =
                existingContract.startDate;


            let newEndDate =
                existingContract.endDate;


            if (
                startDate !== undefined
            ) {

                newStartDate =
                    new Date(
                        `${startDate}T00:00:00`
                    );

            }


            if (
                endDate !== undefined
            ) {

                newEndDate =
                    new Date(
                        `${endDate}T00:00:00`
                    );

            }


            if (
                Number.isNaN(
                    newStartDate.getTime()
                ) ||
                Number.isNaN(
                    newEndDate.getTime()
                )
            ) {

                return res.status(400).json({

                    message:
                        "Некорректная дата договора"

                });

            }


            if (
                newEndDate <
                newStartDate
            ) {

                return res.status(400).json({

                    message:
                        "Дата окончания не может быть раньше даты начала"

                });

            }

            let newRent =
                existingContract.rent;


            if (
                rent !== undefined
            ) {

                newRent =
                    Number(rent);


                if (
                    !Number.isFinite(
                        newRent
                    ) ||
                    newRent < 0
                ) {

                    return res.status(400).json({

                        message:
                            "Некорректная стоимость аренды"

                    });

                }

            }

            let newDeposit =
                existingContract.deposit;


            if (
                deposit !== undefined
            ) {

                newDeposit =
                    deposit === null ||
                    deposit === ""
                        ? null
                        : Number(deposit);


                if (
                    newDeposit !== null &&
                    (
                        !Number.isFinite(
                            newDeposit
                        ) ||
                        newDeposit < 0
                    )
                ) {

                    return res.status(400).json({

                        message:
                            "Некорректная сумма депозита"

                    });

                }

            }

            let newPaymentDay =
                existingContract.paymentDay;


            if (
                paymentDay !== undefined
            ) {

                newPaymentDay =
                    paymentDay === null ||
                    paymentDay === ""
                        ? null
                        : Number(paymentDay);


                if (
                    newPaymentDay !== null &&
                    (
                        !Number.isInteger(
                            newPaymentDay
                        ) ||
                        newPaymentDay < 1 ||
                        newPaymentDay > 31
                    )
                ) {

                    return res.status(400).json({

                        message:
                            "День оплаты должен быть от 1 до 31"

                    });

                }

            }

            const allowedStatuses = [

                "DRAFT",
                "ACTIVE",
                "EXPIRED",
                "TERMINATED"

            ];


            const newStatus =
                status !== undefined
                    ? status
                    : existingContract.status;


            if (
                !allowedStatuses.includes(
                    newStatus
                )
            ) {

                return res.status(400).json({

                    message:
                        "Некорректный статус договора"

                });

            }

            let newPropertyId =
                existingContract.propertyId;


            let property =
                await prisma.property.findFirst({

                    where: {

                        id:
                            newPropertyId,

                        ownerId:
                            req.user.userId

                    }

                });


            if (
                propertyId !== undefined
            ) {

                newPropertyId =
                    Number(propertyId);


                if (
                    Number.isNaN(
                        newPropertyId
                    )
                ) {

                    return res.status(400).json({

                        message:
                            "Некорректный ID объекта"

                    });

                }


                property =
                    await prisma.property.findFirst({

                        where: {

                            id:
                                newPropertyId,

                            ownerId:
                                req.user.userId

                        }

                    });


                if (!property) {

                    return res.status(404).json({

                        message:
                            "Объект не найден"

                    });

                }

            }

            let newTenantId =
                existingContract.tenantId;


            let tenant =
                await prisma.tenant.findFirst({

                    where: {

                        id:
                            newTenantId,

                        ownerId:
                            req.user.userId

                    }

                });


            if (
                tenantId !== undefined
            ) {

                newTenantId =
                    Number(tenantId);


                if (
                    Number.isNaN(
                        newTenantId
                    )
                ) {

                    return res.status(400).json({

                        message:
                            "Некорректный ID арендатора"

                    });

                }


                tenant =
                    await prisma.tenant.findFirst({

                        where: {

                            id:
                                newTenantId,

                            ownerId:
                                req.user.userId

                        }

                    });


                if (!tenant) {

                    return res.status(404).json({

                        message:
                            "Арендатор не найден"

                    });

                }

            }

            const updatedContract =
                await prisma.$transaction(
                    async (tx) => {


                        if (
                            newPropertyId !==
                            existingContract.propertyId
                        ) {

                            const otherContract =
                                await tx.contract.findFirst({

                                    where: {

                                        propertyId:
                                            existingContract.propertyId,

                                        status:
                                            "ACTIVE",

                                        NOT: {

                                            id

                                        }

                                    }

                                });


                            if (!otherContract) {

                                await tx.property.update({

                                    where: {

                                        id:
                                            existingContract.propertyId

                                    },

                                    data: {

                                        tenantId:
                                            null,

                                        tenantName:
                                            null,

                                        status:
                                            "AVAILABLE"

                                    }

                                });

                            }

                        }



                        const contract =
                            await tx.contract.update({

                                where: {

                                    id

                                },

                                data: {

                                    number:
                                        newNumber,

                                    startDate:
                                        newStartDate,

                                    endDate:
                                        newEndDate,

                                    rent:
                                        newRent,

                                    deposit:
                                        newDeposit,

                                    paymentDay:
                                        newPaymentDay,

                                    status:
                                        newStatus,

                                    notes:
                                        notes !== undefined
                                            ? (
                                                notes
                                                    ? notes.trim()
                                                    : null
                                            )
                                            : existingContract.notes,

                                    propertyId:
                                        newPropertyId,

                                    tenantId:
                                        newTenantId

                                },

                                include: {

                                    property: true,

                                    tenant: true

                                }

                            });



                        if (
                            newStatus ===
                            "ACTIVE"
                        ) {

                            await tx.property.update({

                                where: {

                                    id:
                                        newPropertyId

                                },

                                data: {

                                    status:
                                        "RENTED",

                                    tenantId:
                                        newTenantId,

                                    tenantName:
                                        tenant.fullName

                                }

                            });

                        } else {

                            const anotherActiveContract =
                                await tx.contract.findFirst({

                                    where: {

                                        propertyId:
                                            newPropertyId,

                                        status:
                                            "ACTIVE"

                                    }

                                });


                            if (
                                !anotherActiveContract
                            ) {

                                await tx.property.update({

                                    where: {

                                        id:
                                            newPropertyId

                                    },

                                    data: {

                                        status:
                                            "AVAILABLE",

                                        tenantId:
                                            null,

                                        tenantName:
                                            null

                                    }

                                });

                            }

                        }


                        return contract;

                    }
                );


            res.json({

                message:
                    "Договор успешно обновлён",

                contract:
                    updatedContract

            });

        } catch (error) {

            console.error(
                "Ошибка изменения договора:",
                error
            );


            if (
                error?.code ===
                "P2002"
            ) {

                return res.status(409).json({

                    message:
                        "Договор с таким номером уже существует"

                });

            }


            res.status(500).json({

                message:
                    "Ошибка при изменении договора"

            });

        }

    }
);



app.delete(
    "/api/contracts/:id",
    authenticateToken,
    async (req, res) => {

        try {

            const id =
                Number(
                    req.params.id
                );


            if (
                Number.isNaN(id)
            ) {

                return res.status(400).json({

                    message:
                        "Некорректный ID договора"

                });

            }


            const contract =
                await prisma.contract.findFirst({

                    where: {

                        id,

                        ownerId:
                            req.user.userId

                    }

                });


            if (!contract) {

                return res.status(404).json({

                    message:
                        "Договор не найден"

                });

            }


            await prisma.$transaction(
                async (tx) => {

                    await tx.contract.delete({

                        where: {

                            id

                        }

                    });



                    const activeContract =
                        await tx.contract.findFirst({

                            where: {

                                propertyId:
                                    contract.propertyId,

                                status:
                                    "ACTIVE"

                            }

                        });


                    if (!activeContract) {

                        await tx.property.update({

                            where: {

                                id:
                                    contract.propertyId

                            },

                            data: {

                                tenantId:
                                    null,

                                tenantName:
                                    null,

                                status:
                                    "AVAILABLE"

                            }

                        });

                    }

                }
            );


            res.json({

                message:
                    "Договор успешно удалён"

            });

        } catch (error) {

            console.error(
                "Ошибка удаления договора:",
                error
            );


            res.status(500).json({

                message:
                    "Ошибка при удалении договора"

            });

        }

    }
);

app.use(
    "/api/payments",
    createPaymentsRouter(
        prisma,
        authenticateToken
    )
);

app.use(
    "/api/requests",
    createRequestsRouter(prisma, authenticateToken)
);

app.use(
    "/api/messages",
    createMessagesRouter(prisma, authenticateToken)
);

app.use(
    "/api/analytics",
    createAnalyticsRouter(prisma, authenticateToken)
);

app.use(
    "/api",
    (req, res) => {

        res.status(404).json({

            message:
                `API маршрут не найден: ${req.method} ${req.originalUrl}`

        });

    }
);

app.listen(
    PORT,
    () => {

        console.log(
            `Server started: http://localhost:${PORT}`
        );

    }
);

process.on(
    "SIGINT",
    async () => {

        await prisma.$disconnect();

        process.exit(0);

    }
);