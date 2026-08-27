import express from "express";
import appConfig from "./config/appConfig.js";
import dotenv from "dotenv";
import connectDB from "./database/connectdb.js";
import cookieParser from "cookie-parser";
import authRoutes from "./routes/authRoutes.js";
import bakeryRoutes from "./routes/bakery.routes.js";
import mediaRoutes from "./routes/media.routes.js";
import categoryRoutes from "./routes/category.routes.js";
import itemRoutes from "./routes/item.routes.js";
import menuRoutes from "./routes/menu.routes.js";
import dashboardRoutes from "./routes/dashboard.routes.js";
import { apiErrorLogger, requestLogger } from "./middleware/logging.middleware.js";
import cors from 'cors'



dotenv.config();

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use(requestLogger);

const allowedOrigins = [
    "http://192.168.226.94:5173",
    "http://localhost:5173",
    "http://localhost:5174",
    "http://127.0.0.1:5173",
    "http://172.26.58.236:5173",
    "http://https://dashboard.anthony101.me/"
];

app.use(cors({
    origin(origin, callback) {
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error("Not allowed by CORS"));
        }
    },
    credentials: true
}));

await connectDB();

//auth post home page
app.get("/", (req, res) => {
    res.json("backend is live");
})

app.use("/api/auth", authRoutes);
app.use("/api/bakery", bakeryRoutes);
app.use("/api/media", mediaRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/items", itemRoutes);
app.use("/api/menu", menuRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use(apiErrorLogger);


app.listen(appConfig.port, () => {
    console.log(`backend server is running on the port:${appConfig.port}`)
})
