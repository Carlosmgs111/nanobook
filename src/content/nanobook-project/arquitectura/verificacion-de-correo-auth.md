---
id: "caa4e3f9-350d-460b-a8e0-e8a825c286ee"
title: "Verificación de correo en autenticación"
description: "Decisión de seguridad para verificar cuentas locales antes de crear sesiones o vincular identidades sociales."
date: 2026-10-03
author: "Nanobook Team"
tags: ["arquitectura", "autenticación", "seguridad", "correo"]
draft: false
---

## Decisión

Las cuentas creadas con correo y contraseña permanecen sin sesión hasta que la
persona confirme la dirección mediante un enlace de un solo uso generado por
Better Auth.

El enlace se entrega a través de Resend. Better Auth conserva la creación,
caducidad y consumo del token en su tabla `verification`; Nanobook solo adapta
el envío del mensaje desde `src/auth/server/ResendEmailSender.ts`.

## Política de vinculación social

Un proveedor social puede vincularse automáticamente a una cuenta local solo
cuando ambas condiciones se cumplen:

1. el proveedor informa el mismo correo como verificado;
2. la cuenta local ya tiene `emailVerified = true`.

Si existe una cuenta local no verificada con el mismo correo, no se vincula la
identidad social. La persona debe confirmar antes que controla el correo local.
Esto evita que alguien registre preventivamente la dirección de otra persona y
después obtenga acceso cuando esa persona use un proveedor social.

## Configuración

```text
RESEND_API_KEY=re_...
EMAIL_FROM=Nanobook <no-reply@your-verified-domain.example>
```

En desarrollo, si `EMAIL_FROM` no está definido, se usa
`Nanobook <onboarding@resend.dev>` como remitente de prueba. No debe usarse ese
remitente como configuración de producción: antes se debe verificar un dominio
en Resend.

## Experiencia de usuario

Después del registro se dirige a `/verify-email`, que explica que debe abrir el
mensaje recibido. Al confirmar, Better Auth crea la sesión automáticamente y
redirecciona a `/`.
