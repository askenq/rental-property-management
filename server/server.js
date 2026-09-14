import "dotenv/config";

import express from "express";
import cors from "cors";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import path from "path";
import { fileURLToPath } from "url";

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";


const app = express();

const PORT = 3000;

const JWT_SECRET = process.env.JWT_SECRET;


/* =========================
   ПУТИ
========================= */

const __filename =
    fileURLToPath(import.meta.url);

const __dirname =
    path.dirname(__filename);

const clientPath =
    path.join(__dirname, "..", "client");


/* =========================
   ПРОВЕРКА НАСТРОЕК
========================= */

if (!JWT_SECRET) {

    console.error(
        "Ошибка: JWT_SECRET не найден в .env"
    );

    process.exit(1);
}


/* =========================
   PRISMA
========================= */

const adapter = new PrismaPg({

    connectionString:
        process.env.DATABASE_URL

});


const prisma = new PrismaClient({
    adapter
});


/* =========================
   MIDDLEWARE
========================= */

app.use(cors());

app.use(express.json());


/* =========================
   СТАТИЧЕСКИЕ ФАЙЛЫ CLIENT
========================= */

app.use(
    express.static(clientPath)
);


/* =========================
   ГЛАВНАЯ СТРАНИЦА
========================= */

app.get("/", (req, res) => {

    res.sendFile(
        path.join(
            clientPath,
            "index.html"
        )
    );

});


/* ==================================================
   АВТОРИЗАЦИЯ
================================================== */


/* =========================
   РЕГИСТРАЦИЯ
========================= */

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


            if (!allowedRoles.includes(role)) {

                return res.status(400).json({
                    message:
                        "Некорректная роль пользователя"
                });

            }


            if (password.length < 6) {

                return res.status(400).json({
                    message:
                        "Пароль должен содержать минимум 6 символов"
                });

            }


            const normalizedEmail =
                email.trim().toLowerCase();


            const existingUser =
                await prisma.user.findUnique({

                    where: {
                        email: normalizedEmail
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
                        userId: user.id,
                        role: user.role
                    },

                    JWT_SECRET,

                    {
                        expiresIn: "7d"
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
                message: "Ошибка сервера"
            });

        }

    }
);


/* =========================
   ВХОД
========================= */

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
                email.trim().toLowerCase();


            const user =
                await prisma.user.findUnique({

                    where: {
                        email: normalizedEmail
                    }

                });


            if (!user) {

                return res.status(401).json({
                    message:
                        "Неверный email или пароль"
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
                        userId: user.id,
                        role: user.role
                    },

                    JWT_SECRET,

                    {
                        expiresIn: "7d"
                    }

                );


            res.json({

                message:
                    "Вход выполнен успешно",

                user: {

                    id: user.id,
                    name: user.name,
                    email: user.email,
                    role: user.role,
                    createdAt: user.createdAt

                },

                token

            });

        } catch (error) {

            console.error(
                "Ошибка входа:",
                error
            );


            res.status(500).json({
                message: "Ошибка сервера"
            });

        }

    }
);


/* ==================================================
   JWT MIDDLEWARE
================================================== */

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


/* ==================================================
   ТЕКУЩИЙ ПОЛЬЗОВАТЕЛЬ
================================================== */

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
                message: "Ошибка сервера"
            });

        }

    }
);


/* ==================================================
   ПОЛЬЗОВАТЕЛИ
================================================== */

app.get(
    "/api/users",
    authenticateToken,
    async (req, res) => {

        try {

            const users =
                await prisma.user.findMany({

                    orderBy: {

                        id: "asc"

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


/* ==================================================
   ОБЪЕКТЫ
================================================== */


/* =========================
   ПОЛУЧИТЬ ОБЪЕКТЫ
========================= */

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

                        id: "asc"

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


/* =========================
   ПОЛУЧИТЬ ОДИН ОБЪЕКТ
========================= */

app.get(
    "/api/properties/:id",
    authenticateToken,
    async (req, res) => {

        try {

            const id =
                Number(req.params.id);


            if (Number.isNaN(id)) {

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


/* =========================
   ДОБАВИТЬ ОБЪЕКТ
========================= */

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


            if (!allowedTypes.includes(type)) {

                return res.status(400).json({

                    message:
                        "Некорректный тип недвижимости"

                });

            }


            if (!allowedStatuses.includes(status)) {

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


/* =========================
   ИЗМЕНИТЬ ОБЪЕКТ
========================= */

app.put(
    "/api/properties/:id",
    authenticateToken,
    async (req, res) => {

        try {

            const id =
                Number(req.params.id);


            if (Number.isNaN(id)) {

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


/* =========================
   УДАЛИТЬ ОБЪЕКТ
========================= */

app.delete(
    "/api/properties/:id",
    authenticateToken,
    async (req, res) => {

        try {

            const id =
                Number(req.params.id);


            if (Number.isNaN(id)) {

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


/* ==================================================
   ЗАПУСК
================================================== */

app.listen(
    PORT,
    () => {

        console.log(
            `Server started: http://localhost:${PORT}`
        );

    }
);


/* ==================================================
   ЗАКРЫТИЕ PRISMA
================================================== */

process.on(
    "SIGINT",
    async () => {

        await prisma.$disconnect();

        process.exit(0);

    }
);