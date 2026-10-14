# Transactions Demo

Demostración pública e independiente de un panel de transacciones y finanzas. Todos los nombres, correos, importes e historiales incluidos son ficticios. No hay backend, base de datos, n8n ni autenticación: el estado se guarda únicamente en `localStorage` del visitante.

## Desarrollo

```bash
pnpm install
pnpm dev
pnpm test
pnpm typecheck
pnpm build
```

La demo local usa `http://localhost:3004`. `pnpm build` genera el sitio estático en `out/`; Vercel puede importar este repositorio como proyecto Next.js sin variables de entorno.

## Recorrido

El botón **Ver recorrido** abre una introducción y capítulos de Transacciones, Cuentas, Remeseros y Finanzas. El visitante pulsa los controles reales, completa los formularios y confirma una entrada, su asignación, un wire y un cobro externo; el recorrido solo avanza cuando cada acción válida termina. Los botones **Anterior** y **Siguiente** permiten revisar los pasos ya completados sin repetir operaciones; al llegar a un paso nuevo hay que realizar su acción. **Reiniciar demo** restaura los datos ficticios iniciales.
