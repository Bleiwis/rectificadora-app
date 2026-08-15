import { z } from "zod";

const usernameRegex = /^[a-zA-Z0-9._-]{3,32}$/;

export const passwordSchema = z
  .string()
  .min(8, "La clave debe tener al menos 8 caracteres.")
  .max(128, "La clave es demasiado larga.");

export const setupMasterSchema = z
  .object({
    username: z
      .string()
      .min(3, "El usuario debe tener al menos 3 caracteres.")
      .max(32, "El usuario no puede superar 32 caracteres.")
      .regex(usernameRegex, "Usuario inválido. Usa letras, números, punto, guion o guion bajo."),
    displayName: z.string().max(80, "El nombre a mostrar no puede superar 80 caracteres.").optional(),
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ["confirmPassword"],
    message: "Las contraseñas no coinciden.",
  });

export const resetPasswordSchema = z
  .object({
    newPassword: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    path: ["confirmPassword"],
    message: "Las contraseñas no coinciden.",
  });

export const signInUsernameSchema = z.object({
  username: z.string().trim().min(1, "Debes ingresar un usuario."),
});

export const signInPasswordSchema = z.object({
  password: z.string().min(1, "Debes ingresar tu clave."),
});

export const signInSetupPasswordSchema = z
  .object({
    newPassword: passwordSchema,
    confirmNewPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmNewPassword, {
    path: ["confirmNewPassword"],
    message: "Las contraseñas no coinciden.",
  });

export const serverConnectionSchema = z.object({
  serverHost: z.string().trim().min(1, "Debes indicar la IP o hostname del servidor."),
  serverPort: z
    .coerce
    .number()
    .int("El puerto debe ser un número entero.")
    .min(1, "El puerto debe ser mayor a 0.")
    .max(65535, "El puerto debe ser menor o igual a 65535."),
  serverToken: z.string().max(255, "El token es demasiado largo.").optional(),
});

export const serviceFormSchema = z.object({
  name: z.string().trim().min(1, "El nombre es obligatorio.").max(120, "Nombre demasiado largo."),
  category: z.string().trim().min(1, "La categoría es obligatoria."),
  description: z.string().max(600, "La descripción no puede superar 600 caracteres.").optional(),
  priceUSD: z.coerce.number().positive("El valor debe ser mayor a 0."),
});

export const inventoryFormSchema = z.object({
  name: z.string().trim().min(1, "El nombre del artículo es obligatorio.").max(120, "Nombre demasiado largo."),
  category: z.string().trim().min(1, "La categoría es obligatoria."),
  priceUSD: z.coerce.number().nonnegative("El precio no puede ser negativo."),
  quantity: z.coerce.number().int("La cantidad debe ser entera.").nonnegative("La cantidad no puede ser negativa."),
  minStock: z.coerce.number().int("El mínimo debe ser entero.").nonnegative("El mínimo no puede ser negativo."),
  description: z.string().max(600, "La descripción no puede superar 600 caracteres.").optional(),
});

export const createUserSchema = z.object({
  username: z
    .string()
    .trim()
    .min(3, "El usuario debe tener al menos 3 caracteres.")
    .max(32, "El usuario no puede superar 32 caracteres.")
    .regex(usernameRegex, "Usuario inválido. Usa letras, números, punto, guion o guion bajo."),
  displayName: z.string().max(80, "El nombre a mostrar no puede superar 80 caracteres.").optional(),
  role: z.enum(["administrador", "caja"]),
});

export const paymentSchema = z.object({
  amount: z.coerce.number().positive("Ingresa un monto de pago válido."),
  note: z.string().max(300, "La nota no puede superar 300 caracteres.").optional(),
});

export const cancelOrderSchema = z.object({
  reason: z.string().trim().min(1, "Debes indicar el motivo de cancelación.").max(500, "El motivo es demasiado largo."),
});

export const assignResponsibleSchema = z
  .object({
    selectedEmployee: z.string(),
    customEmployeeName: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.selectedEmployee === "custom" && !data.customEmployeeName?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["customEmployeeName"],
        message: "Debes indicar un nombre para el responsable.",
      });
    }
  });

export const clientDataSchema = z.object({
  clientName: z.string().trim().min(1, "Nombre obligatorio."),
  clientLastName: z.string().trim().min(1, "Apellido obligatorio."),
  clientDocumentNumber: z.string().trim().min(5, "Cédula/RIF inválido.").max(20, "Cédula/RIF inválido."),
  clientPhone: z.string().trim().min(7, "Teléfono inválido.").max(20, "Teléfono inválido."),
  engineModel: z.string().trim().min(1, "Modelo del motor obligatorio."),
});

export const partRowSchema = z.object({
  partName: z.string().trim().min(1, "Debes indicar la parte."),
  quantity: z.coerce.number().int("Cantidad inválida.").min(1, "La cantidad debe ser al menos 1."),
  measurement: z.string().max(50, "La medida es demasiado larga.").optional(),
});

export const orderCreationSchema = z.object({
  totalUSD: z.number().positive("Debes seleccionar al menos un servicio o repuesto de inventario."),
  parts: z.array(partRowSchema).min(1, "Debes agregar al menos una parte del motor."),
});

export const partialPaymentSchema = z.object({
  amount: z.coerce.number().positive("Ingresa un monto de abono válido en USD."),
});

export type SetupMasterFormValues = z.infer<typeof setupMasterSchema>;
export type ResetPasswordFormValues = z.infer<typeof resetPasswordSchema>;
export type ServiceFormValues = z.infer<typeof serviceFormSchema>;
export type ServiceFormInputValues = z.input<typeof serviceFormSchema>;
export type InventoryFormValues = z.infer<typeof inventoryFormSchema>;
export type InventoryFormInputValues = z.input<typeof inventoryFormSchema>;
export type CreateUserFormValues = z.infer<typeof createUserSchema>;
export type PaymentFormValues = z.infer<typeof paymentSchema>;
export type PaymentFormInputValues = z.input<typeof paymentSchema>;
export type CancelOrderFormValues = z.infer<typeof cancelOrderSchema>;
export type AssignResponsibleFormValues = z.infer<typeof assignResponsibleSchema>;
