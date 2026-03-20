# FiBot — Características Diferenciadoras frente a Herramientas de IA Genéricas

## 1. Especialización Financiera

A diferencia de chatbots genéricos como ChatGPT, Copilot o Gemini, FiBot está diseñado específicamente para el ámbito financiero. Ofrece tres modelos de IA especializados:

| Modelo            | Proveedor | Enfoque                        |
| ----------------- | --------- | ------------------------------ |
| **FinGPT Expert** | Fibot     | Experto financiero general     |

El usuario puede utilizar el modelo FinGPT Expert, algo que ninguna herramienta de IA convencional ofrece en una sola interfaz.

---

## 2. Conexión Directa a Datos Reales (Data Fabric)

**Este es el diferenciador más importante.** FiBot no se limita a responder con conocimiento general: puede consultar datos financieros reales almacenados en Microsoft Fabric Warehouse.

**Flujo inteligente:**
1. El usuario hace una pregunta en lenguaje natural (ej. *"¿Cuál fue la facturación del último trimestre?"*)
2. La IA genera automáticamente una consulta SQL (T-SQL) a partir de la pregunta
3. FiBot valida la consulta por seguridad (solo lectura, sin inyecciones)
4. Ejecuta la consulta contra la base de datos real
5. La IA interpreta los resultados y genera una respuesta en lenguaje natural con tablas y gráficos

**Ningún chatbot de IA genérico puede consultar tus datos corporativos de esta forma sin configuración adicional del usuario.**

---

## 3. Generación Automática de Gráficos

FiBot transforma respuestas del modelo de IA en gráficos visuales de forma automática mediante integración con QuickChart. Cuando la IA genera especificaciones de gráficos (formato Mermaid), FiBot los convierte en imágenes interactivas sin necesidad de librerías de visualización del lado del cliente.

Las herramientas de IA genéricas devuelven texto plano o, en el mejor de los casos, código que el usuario debe ejecutar por su cuenta.

---

## 4. Exportación de Datos

FiBot detecta automáticamente tablas en las respuestas del asistente y habilita botones de exportación a CSV. Esto permite al usuario llevar los datos a Excel u otras herramientas de análisis con un solo clic.

En herramientas genéricas, el usuario debe copiar y formatear manualmente los datos tabulares.

---

## 5. Arquitectura Segura con Proxy Backend

FiBot implementa un modelo de seguridad donde:

- Las claves de API **nunca se exponen** al navegador del usuario
- Un proxy en AWS Lambda gestiona las credenciales de forma segura
- Las consultas SQL pasan por validación estricta:
  - Solo se permiten operaciones de lectura (`SELECT`, `WITH`)
  - Se bloquean palabras clave peligrosas (`DROP`, `DELETE`, `ALTER`, `EXEC`)
  - Se filtran comentarios SQL para prevenir inyección de código
  - Se aplica whitelist de tablas y esquemas permitidos
- Cifrado de extremo a extremo indicado en la interfaz

Las herramientas genéricas de IA no ofrecen este nivel de control sobre la seguridad de datos corporativos.

---

## 6. Interfaz Bilingüe (Español / Inglés)

FiBot ofrece soporte completo en español e inglés, incluyendo:

- Toda la interfaz de usuario traducida
- Preferencia de idioma persistente entre sesiones
- El idioma seleccionado se envía al backend para que las respuestas de la IA también sean en el idioma elegido

La mayoría de herramientas de IA responden en el idioma de la pregunta, pero la interfaz permanece en inglés.

---

## 7. Sugerencias Contextuales Financieras

Al iniciar una conversación, FiBot muestra chips de sugerencias específicos del dominio financiero:

- *"Generar gráficos de Facturación"*
- *"Costos y gastos"*
- *"Utilidad neta"*

Esto guía al usuario hacia consultas productivas desde el primer momento, a diferencia de las herramientas genéricas que presentan un campo de texto vacío.

---

## 8. Renderizado Enriquecido y Seguro

FiBot combina capacidades de renderizado avanzadas:

- **Markdown** completo (tablas, listas, código, negritas)
- **HTML sanitizado** con DOMPurify para prevenir ataques XSS
- **Tipografía profesional** optimizada para lectura de datos financieros
- **Modo oscuro/claro** con detección automática de preferencia del sistema

---

## 9. Descubrimiento Automático de Esquemas

FiBot consulta automáticamente la estructura de la base de datos (`INFORMATION_SCHEMA.COLUMNS`) para entender qué datos están disponibles. Esto permite:

- Generar SQL preciso sin que el usuario conozca la estructura de las tablas
- Re-intentar automáticamente si una consulta falla por referencia incorrecta a una tabla
- Adaptarse dinámicamente a cambios en el esquema de datos

---

## 10. Despliegue Empresarial Listo

FiBot está diseñado para entornos corporativos:

- **Frontend:** React en S3 + CloudFront
- **Backend:** AWS Lambda (Node.js 20.x)
- **Base de datos:** Microsoft Fabric Warehouse
- **Autenticación:** Azure Service Principal
- **Testing:** Pruebas unitarias (Vitest) y E2E (Playwright)

---

## Resumen Comparativo

| Característica                          | FiBot | ChatGPT | Copilot | Gemini |
| --------------------------------------- | :---: | :-----: | :-----: | :----: |
| Especialización financiera              |  Si   |   No    |   No    |   No   |
| Consulta datos corporativos en vivo     |  Si   |   No    |   No    |   No   |
| Generación automática de gráficos       |  Si   | Parcial | Parcial |   No   |
| Exportación a CSV con un clic           |  Si   |   No    |   No    |   No   |
| Múltiples modelos de IA en una interfaz |  Si   |   No    |   No    |   No   |
| Proxy seguro para credenciales          |  Si   |  N/A    |  N/A    |  N/A   |
| Validación de SQL contra inyecciones    |  Si   |  N/A    |  N/A    |  N/A   |
| Interfaz bilingüe completa              |  Si   | Parcial | Parcial | Parcial|
| Sugerencias financieras contextuales    |  Si   |   No    |   No    |   No   |
| Despliegue empresarial (AWS + Azure)    |  Si   |  SaaS   |  SaaS   |  SaaS  |
