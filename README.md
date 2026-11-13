# CATÁLOGO-EQUIPOS · Malezas y Madurantes

App web (celular, escritorio y APK de Android) con el catálogo de equipos del Departamento de Malezas y Madurantes, Ingenio Madre Tierra.
Los datos están en la hoja de Google Sheets **EQUIPOS TALLER MALEZAS**. Todo vive en la cuenta **malezasymadurantes@madretierra.com.gt**. Las fotos se guardan en la carpeta de Drive **EQUIPOS MALEZAS** de esa cuenta (el script la crea sola) (una subcarpeta por tipo de equipo y otra por código).

## Qué hace
| Sección | Contenido |
|---|---|
| **Inicio** | Filtro por una o varias zonas. Total, listos en campo, en reparación/pendientes y vencidos. Tabla **en reparación por zona y grupo**, y un **resumen por zona** (listos vs. en reparación por grupo, como en las presentaciones). Botón **Cargar Excel actualizado** (administrador). |
| **En reparación** | En taller + pendientes de ingreso: ingreso, fecha requerida, días en taller y **días vencido**. Filtros de varias zonas y tipos a la vez (se recuerdan). |
| **En campo** | Equipos listos: fecha de salida del taller. |
| **Actualizaciones** | Cada carga de Excel se compara con la anterior: equipos que quedaron listos, regresaron a taller, nuevos o quitados (pestaña `ACTUALIZACIONES`). |
| **Catálogo** | Todos los equipos con foto y descripción. Al abrir uno: tomar o subir foto, **boquillas, bajantes y filtros** (cantidad + foto), ubicación GPS y **observaciones** de la revisión. |
| **Ubicación** | Mapa satelital con los equipos que tienen GPS guardado. |
| **Generar reporte** | PDF con el resumen campo/taller, por tipo y zona, equipos atrasados, observaciones y conteo de componentes. |

**Días vencido** = días pasados de la *FECHA DE REQUERIMIENTO POR PARTE DEL USUARIO* (si no la tiene: ingreso + 30 días). **Listo** = tiene fecha en que el taller lo entregó; **en reparación / pendiente** = todo lo demás.

## Pestañas de la hoja
| Pestaña | Para qué |
|---|---|
| `Hoja 1` | El Excel de malezas. Se reemplaza al cargar un Excel nuevo (antes se copia en la pestaña oculta `RESPALDO`). |
| `CATALOGO` | Lo que se llena desde la app: descripción, fotos (ID de Drive), boquillas, bajantes, filtros, GPS, observaciones. Una carga de Excel **no** la toca. |
| `BOQUILLAS` | Solo las boquillas que se asignan a mano desde la app (botón **+ Agregar boquilla** en la ficha del equipo): tipo, cantidad total, filtros, tipo de control, equipo, mes y foto. |
| `BOQUILLAS EXCEL (referencia)` | El Excel de boquillas original, solo como consulta. La app no lo muestra; de ahí salen las listas de tipos de boquilla y tipos de control. |
| `USUARIOS` | `USUARIO · CONTRASEÑA · ROL · NOMBRE`. ROL `ADMINISTRADOR` edita todo; `PUBLICO` solo consulta y genera reportes. |

## 1. Apps Script (una sola vez)
1. Abra la hoja › **Extensiones › Apps Script**.
2. Borre lo que haya en `Código.gs` y pegue todo `Code.gs`. Guarde.
3. Elija la función **`autorizar`** › **Ejecutar** › acepte los permisos (Hojas y Drive).
4. **Implementar › Nueva implementación** › tipo **Aplicación web** · Ejecutar como: **Yo** · Acceso: **Cualquier persona**.
5. Copie la URL que termina en `/exec` y pruébela: `URL/exec?action=diag`.

> Cada vez que cambie `Code.gs`: **Implementar › Gestionar implementaciones › ✏️ › Versión: Nueva versión** (así se conserva la URL).

## 2. Página
1. En `index.html` cambie `PEGAR_AQUI_LA_URL_DEL_APPS_SCRIPT` por la URL `/exec`.
2. **Settings › Pages** › Branch `main` / root › Save.
3. Escritorio: abra la página en Chrome/Edge › ícono **Instalar** en la barra de direcciones.
4. Android: descargue el APK desde la pantalla de inicio de sesión (lo arma GitHub Actions al cambiar `android/`).

> Para que el APK se actualice sin desinstalar, agregue los secretos `KS_B64` y `KS_PASS` (Settings › Secrets › Actions), igual que en CALIBRACION-DRONES.
