# Diagramas C4

- [Nivel 1 – Contexto](01-context.md)
- [Nivel 2 – Contenedores](02-container.md)
- [Nivel 3 – Componentes](03-component.md)

Los diagramas están en Mermaid (fuente de verdad) y se renderizan directamente en GitHub/GitLab. Cada archivo
incluye además el PNG exportado (`*-1.png`) para leerlos sin conexión, por ejemplo desde el `.zip` de la entrega.

Para regenerar un PNG después de editar un diagrama, copiar el bloque mermaid a un `.mmd` y ejecutar desde `docs/c4/`
(`puppeteer.json` agranda la ventana del navegador headless; sin eso Mermaid acomoda solo 2 cajas por fila):

```bash
npx @mermaid-js/mermaid-cli@11 -p puppeteer.json -w 1500 -b "#fafafa" -i container.mmd -o container-1.png
```
