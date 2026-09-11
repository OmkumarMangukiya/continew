import { z } from "zod"

export const registerUserSchema = z.object({
    email : z.email(),
    password : z.string().min(8).max(20),
    username : z.string().min(3).max(15)
});

export const loginUserSchema = z.object({
    email : z.email(),
    password : z.string().min(8).max(20)
});