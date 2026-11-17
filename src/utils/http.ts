import { z } from 'zod';

export class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export const idSchema = z.string().regex(/^[a-fA-F0-9]{24}$/, 'Invalid ID');
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).max(100000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
});
export function pagination(query: unknown) {
  const { page, limit } = paginationSchema.parse(query);
  return { page, limit, skip: (page - 1) * limit };
}
export function meta(page: number, limit: number, total: number) {
  return { page, limit, total, totalPages: Math.ceil(total / limit) };
}
export const credentialsSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email().max(254)),
  password: z.string().min(8).refine(value => Buffer.byteLength(value, 'utf8') <= 72,
    'Password must be at most 72 UTF-8 bytes'),
});
export const profileSchema = z.object({
  name: z.string().trim().min(1).max(100),
  interests: z.array(z.string().trim().min(1).max(50)).max(20)
    .transform(values => [...new Set(values)]).default([]),
});
export const contentSchema = z.object({
  title: z.string().trim().min(1).max(200),
  content: z.string().trim().min(1).max(50000),
});
