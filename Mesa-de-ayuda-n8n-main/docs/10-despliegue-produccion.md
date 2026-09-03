# YaviBot — Despliegue en producción (paso a paso)

> **Nota sobre credenciales.** Este documento está versionado en Git, así que
> **no contiene ninguna contraseña**. Donde veas `<...>` sustituye por el valor
> real en tu terminal, nunca en este archivo.

---

## 0. Diagnóstico del servidor entregado

Antes de nada, hay que aclarar qué es el servidor que te pasaron, porque
condiciona todo el despliegue.

**Datos entregados**

| Dato | Valor |
|------|-------|
| FTP | `ftp.hd.linkear.net` |
| Ruta | `/home/u868810105/domains/hd.linkear.net/public_html` |
| Usuario | `u868810105.ely` |

**Comprobaciones realizadas** (`hd.linkear.net` → `157.173.208.226`)

| Puerto | Servicio | Estado |
|--------|----------|--------|
| 21 | FTP | **abierto** |
| 22 | SSH | **cerrado** |
| 80 / 443 | HTTP / HTTPS | **abiertos** |
| 5432 | PostgreSQL | cerrado |
| 5678 | n8n | cerrado |

**Conclusión: no es un VPS, es un _hosting compartido_.**

Tres señales lo confirman:

1. La ruta `/home/u<9 dígitos>/domains/<dominio>/public_html` es el diseño de
   carpetas típico del hosting compartido (Hostinger y similares).
2. **No hay SSH.** Sin SSH no hay terminal, y sin terminal no se puede instalar
   ni ejecutar nada.
3. El acceso es solo FTP, que sirve para *copiar archivos*, no para
   *ejecutar programas*.

### Qué implica para YaviBot

YaviBot no es un sitio web estático: son **tres programas que tienen que estar
ejecutándose** (PostgreSQL, n8n y el servidor que entrega el frontend). Un
hosting compartido solo entrega archivos por HTTP; no permite Docker, ni
PostgreSQL, ni Node, ni procesos propios.

| Componente | ¿Se puede en ese hosting? | Por qué |
|------------|---------------------------|---------|
| Frontend Angular (`dist/`) | **Sí** | Son archivos estáticos (HTML, JS, CSS) |
| PostgreSQL 16 | **No** | Es un servicio; requiere instalación y un proceso activo |
| n8n (los 17 workflows) | **No** | Es una aplicación Node; requiere un proceso activo |
| Envío de correo, PDF, QR | **No** | Se ejecutan dentro de n8n |

En resumen: **ahí puedes publicar la interfaz, pero no el sistema.** Si subes
solo el frontend, la pantalla carga, pero al escribir la cédula no pasará nada,
porque no hay backend al que llamar.

### Lo que hay que pedir

Para desplegar YaviBot completo necesitas un servidor con:

- **Acceso SSH** (usuario y contraseña, o clave)
- **Ubuntu 22.04 LTS** o similar, con permisos de administrador (`sudo`)
- **2 GB de RAM** como mínimo (n8n + PostgreSQL); recomendable 4 GB
- **20 GB de disco**
- Puertos **80 y 443** abiertos

Pide esto textualmente a quien te dio el servidor:

> «Necesito un VPS con acceso SSH y permisos de root, porque el sistema
> requiere ejecutar Docker con PostgreSQL y n8n. El hosting compartido que me
> dieron solo permite subir archivos por FTP y no puede ejecutar servicios.»

### Las dos rutas posibles

- **Ruta A (recomendada).** Todo en un VPS: base de datos, n8n y frontend. Es
  la única que deja el sistema funcionando de verdad. → **Partes 1 a 6.**
- **Ruta B (parcial).** Frontend en el hosting actual + n8n y base de datos en
  un VPS aparte. Funciona, pero añade un problema de **CORS** (el navegador
  bloquea las llamadas entre dominios distintos) que hay que resolver aparte.
  → **Parte 7.**

> Con la Ruta A todo queda en el mismo dominio y no hay CORS que resolver. Es
> más simple y más segura. Este documento la desarrolla como camino principal.

---

## 1. Preparar el paquete de migración (en tu PC)

La idea es **copiar el estado actual tal cual**, sin reconstruir nada: los
datos, los workflows y los archivos generados viajan como están.

Levanta los servicios si no lo están y sitúate en la carpeta del proyecto:

```bash
cd "C:/Users/WELCOME/Documents/5toBAndersonNarvaez/Mesa de ayuda n8n"
```

### 1.1 Copia de la base de datos

Vuelca **todo** (estructura + datos) a un solo archivo:

```bash
docker exec yavibot-postgres pg_dump -U yavibot -d yavibot --no-owner --no-privileges > yavibot-datos.sql
```

Esto conserva los 1401 estudiantes, 107 docentes, 111 usuarios del panel,
tickets, alertas y certificados. Comprueba que no salió vacío:

```bash
ls -lh yavibot-datos.sql
```

### 1.2 Copia de n8n (los 17 workflows y la cuenta de acceso)

n8n guarda todo en un volumen de Docker llamado `mesadeayudan8n_n8n_data`
(workflows, cuenta del dueño y clave de cifrado). Se empaqueta así:

```bash
docker run --rm -v mesadeayudan8n_n8n_data:/data -v "$PWD":/backup alpine tar czf /backup/n8n-data.tar.gz -C /data .
```

> Copiar el volumen entero es lo que evita reconstruir: los workflows llegan
> **activos y con su configuración**, sin reimportarlos uno a uno.

### 1.3 Archivos generados y plantillas

```bash
tar czf yavibot-archivos.tar.gz storage/ n8n/plantillas/ n8n/libs/
```

- `storage/` → certificados PDF emitidos y fotos de las alertas (~7 MB)
- `n8n/plantillas/` → el membrete oficial del certificado
- `n8n/libs/` → librerías que usan los workflows (pdfkit, qrcode, bcryptjs…)

### 1.4 Resumen de lo que llevas

| Archivo | Contiene | Peso aprox. |
|---------|----------|-------------|
| `yavibot-datos.sql` | Toda la base de datos | ~10 MB |
| `n8n-data.tar.gz` | Los 17 workflows y la cuenta de n8n | ~5 MB |
| `yavibot-archivos.tar.gz` | Certificados, fotos, membrete y librerías | ~30 MB |
| El repositorio (Git) | Código, `docker-compose.yml`, scripts SQL | — |

---

## 2. Ajustes obligatorios antes de subir

Hay valores de desarrollo escritos en el código. **En producción hay que
cambiarlos**; si no, el sistema queda abierto.

### 2.1 Dirección del backend (frontend)

En `frontend/src/app/core/config/app-config.ts`:

```ts
n8nBaseUrl: 'https://<TU-DOMINIO>/webhook',   // antes: http://localhost:5678/webhook
```

### 2.2 Dirección del QR del certificado

En `n8n/workflows/chatbot-certificado.json` está la URL que se imprime en el QR:

```js
const verifyUrl = 'https://<TU-DOMINIO>/verificar/' + qr.identificador;
```

> Si no la cambias, los QR de los certificados nuevos seguirán apuntando a
> `localhost` y **no se podrán verificar** fuera de tu computadora.

### 2.3 Secretos

| Qué | Dónde | Valor actual (desarrollo) |
|-----|-------|---------------------------|
| Secreto del JWT | 15 workflows en `n8n/workflows/` | `yavibot-dev-secret-change-me` |
| Contraseña de PostgreSQL | `docker-compose.yml` y 15 workflows | `yavibot_dev_2026` |
| Contraseña de pgAdmin | `docker-compose.yml` | — |
| Contraseña del dueño de n8n | Dentro de n8n | — |
| Contraseña del superadministrador | `database/08-seed-superadmin.sql` | — |

Genera un secreto nuevo para el JWT:

```bash
openssl rand -hex 32
```

Y reemplázalo en los 15 workflows de una vez (ajusta los valores):

```bash
grep -rl "yavibot-dev-secret-change-me" n8n/workflows/ | xargs sed -i "s/yavibot-dev-secret-change-me/<SECRETO-NUEVO>/g"
```

Lo mismo con la contraseña de la base:

```bash
grep -rl "yavibot_dev_2026" n8n/workflows/ docker-compose.yml | xargs sed -i "s/yavibot_dev_2026/<CONTRASENA-NUEVA>/g"
```

> **Importante:** cambia la contraseña **antes** de restaurar la base en el
> servidor, para que `docker-compose.yml` y los workflows coincidan.

### 2.4 Compilar el frontend

Con la URL ya corregida:

```bash
cd frontend && npm run build
```

El resultado queda en `frontend/dist/frontend/browser/` (~9 MB).

---

## 3. Conectarse al servidor

### 3.1 Por SSH (VPS — Ruta A)

```bash
ssh <usuario>@<ip-del-vps>
```

La primera vez te pedirá aceptar la huella del servidor: escribe `yes`. Luego
te pedirá la contraseña (no se ve mientras la escribes; es normal).

### 3.2 Por FTP (hosting compartido — Ruta B)

Descarga **FileZilla** (gratuito) y crea el sitio en *Archivo → Gestor de sitios*:

| Campo | Valor |
|-------|-------|
| Servidor | `ftp.hd.linkear.net` |
| Protocolo | FTP |
| Cifrado | *Requiere FTP explícito sobre TLS* |
| Usuario | `u868810105.ely` |
| Contraseña | la que te entregaron |

Al conectar, navega a `/domains/hd.linkear.net/public_html`.

> ⚠️ La contraseña del FTP viajó por chat. Cámbiala desde el panel del hosting
> en cuanto puedas y no la vuelvas a compartir por ese medio.

---

## 4. Preparar el VPS (una sola vez)

Conectado por SSH:

```bash
sudo apt update && sudo apt upgrade -y
```

Instala Docker:

```bash
curl -fsSL https://get.docker.com | sudo sh
```

Permite usar Docker sin `sudo` (cierra la sesión y vuelve a entrar después):

```bash
sudo usermod -aG docker $USER
```

Verifica:

```bash
docker --version && docker compose version
```

---

## 5. Subir y restaurar el proyecto

### 5.1 Subir los archivos

Desde **tu PC** (no desde el servidor), en la carpeta del proyecto:

```bash
scp yavibot-datos.sql n8n-data.tar.gz yavibot-archivos.tar.gz <usuario>@<ip-del-vps>:~/
```

Y el código, con Git (lo más limpio) o comprimido:

```bash
ssh <usuario>@<ip-del-vps> "git clone <URL-DE-TU-REPOSITORIO> yavibot"
```

### 5.2 Colocar los archivos generados

Ya en el servidor:

```bash
cd ~/yavibot && tar xzf ~/yavibot-archivos.tar.gz
```

**Y dale a n8n la propiedad de las carpetas donde escribe** (este paso es
obligatorio):

```bash
chown -R 1000:1000 ~/yavibot/storage ~/yavibot/n8n/plantillas
```

> Dentro del contenedor n8n corre como el usuario `node`, que tiene el id
> **1000**. Al desempaquetar como `root` (o desde un paquete hecho en Windows),
> las carpetas quedan con otro dueño y permisos `755`, así que n8n puede leer
> pero **no escribir**. El síntoma es que el chatbot genera el certificado y
> falla al guardarlo, con `EACCES: permission denied` en
> `/data/storage/certificados/…`; lo mismo ocurriría con las fotos de las
> alertas en `/data/storage/uploads/`.

Comprueba que efectivamente puede escribir:

```bash
docker exec yavibot-n8n sh -c "touch /data/storage/certificados/prueba.tmp && echo 'ESCRITURA OK' && rm /data/storage/certificados/prueba.tmp"
```

### 5.3 Recrear el archivo `.env`

**Este paso lo haces tú**, porque contiene la contraseña del correo:

```bash
nano ~/yavibot/.env
```

Pega el contenido (con tus valores reales) y guarda con `Ctrl+O`, `Enter`,
`Ctrl+X`:

```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=mesadeayuda@yavirac.edu.ec
SMTP_PASS=<contraseña de aplicación de 16 caracteres>
SMTP_FROM=mesadeayuda@yavirac.edu.ec
```

### 5.4 Levantar la base de datos y restaurar los datos

```bash
cd ~/yavibot && docker compose up -d postgres
```

Espera a que esté lista (`healthy`):

```bash
docker compose ps
```

Restaura el volcado:

```bash
docker exec -i yavibot-postgres psql -U yavibot -d yavibot < ~/yavibot-datos.sql
```

Comprueba que llegó todo:

```bash
docker exec yavibot-postgres psql -U yavibot -d yavibot -c "SELECT count(*) FROM estudiantes;"
```

Debe responder **1401**.

### 5.5 Restaurar n8n con sus workflows

Crea el volumen y vuelca dentro la copia:

```bash
docker volume create mesadeayudan8n_n8n_data
docker run --rm -v mesadeayudan8n_n8n_data:/data -v ~:/backup alpine tar xzf /backup/n8n-data.tar.gz -C /data
```

Levanta el resto:

```bash
cd ~/yavibot && docker compose up -d
```

Verifica que los 17 workflows quedaron activos:

```bash
docker logs yavibot-n8n 2>&1 | grep -c "Activated workflow"
```

### 5.6 Publicar el frontend

Sube el contenido de `frontend/dist/frontend/browser/` desde tu PC:

```bash
scp -r frontend/dist/frontend/browser/* <usuario>@<ip-del-vps>:~/yavibot/web/
```

---

## 6. Servidor web y HTTPS

Falta lo que une todo: un **Nginx** que entregue el frontend y redirija las
llamadas `/webhook` a n8n, de modo que todo viva bajo el mismo dominio (y así
no haya problemas de CORS).

Instálalo:

```bash
sudo apt install -y nginx
```

Crea la configuración:

```bash
sudo nano /etc/nginx/sites-available/yavibot
```

Con este contenido (cambia el dominio y la ruta):

```nginx
server {
    listen 80;
    server_name <TU-DOMINIO>;

    # Frontend Angular
    root /home/<usuario>/yavibot/web;
    index index.html;

    # Angular maneja sus propias rutas: si el archivo no existe, va a index.html
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Los webhooks van a n8n, en el mismo dominio (evita CORS)
    location /webhook/ {
        proxy_pass http://127.0.0.1:5678/webhook/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        client_max_body_size 10M;   # las fotos de las alertas pesan hasta 5 MB
    }
}
```

Actívala y recarga:

```bash
sudo ln -s /etc/nginx/sites-available/yavibot /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

Certificado HTTPS gratuito:

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d <TU-DOMINIO>
```

### 6.1 Cerrar los puertos internos

n8n, PostgreSQL y pgAdmin **no deben quedar expuestos** a internet: solo Nginx
habla con ellos. En `docker-compose.yml`, cambia los puertos publicados para
que solo escuchen en local:

```yaml
ports:
  - "127.0.0.1:5678:5678"   # n8n
  - "127.0.0.1:5432:5432"   # PostgreSQL
  - "127.0.0.1:5050:80"     # pgAdmin
```

Y aplica:

```bash
docker compose up -d
```

---

## 7. Ruta B — solo el frontend en el hosting actual

Si además quieres aprovechar `hd.linkear.net` para la interfaz:

1. Compila con la URL del VPS: `n8nBaseUrl: 'https://<DOMINIO-DEL-VPS>/webhook'`.
2. Sube por FTP **el contenido** de `frontend/dist/frontend/browser/` a
   `/domains/hd.linkear.net/public_html` (los archivos sueltos, no la carpeta).
3. Crea en esa misma carpeta un archivo `.htaccess` con:

```apache
RewriteEngine On
RewriteBase /
RewriteRule ^index\.html$ - [L]
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule . /index.html [L]
```

> Sin ese archivo, entrar directo a `hd.linkear.net/panel/login` devuelve
> **404**: Apache busca una carpeta `panel/login` que no existe. El `.htaccess`
> le dice que entregue `index.html` y deje que Angular resuelva la ruta.

4. **Pendiente de resolver: CORS.** El navegador bloqueará las llamadas desde
   `hd.linkear.net` hacia el dominio del VPS. Hay que añadir en las respuestas
   de n8n las cabeceras `Access-Control-Allow-Origin`, y atender las peticiones
   `OPTIONS` previas. Por eso la Ruta A (todo en el mismo dominio) es
   preferible: ese problema simplemente no existe.

---

## 8. Comprobación final

Recorre esta lista antes de darlo por terminado:

| # | Comprobación | Cómo |
|---|--------------|------|
| 1 | Los servicios están arriba | `docker compose ps` → los 3 en `Up` |
| 2 | Los 17 workflows activos | `docker logs yavibot-n8n \| grep -c "Activated workflow"` |
| 3 | Los datos llegaron | `SELECT count(*) FROM estudiantes;` → 1401 |
| 4 | El sitio carga por HTTPS | Abrir `https://<TU-DOMINIO>` |
| 5 | El chatbot responde | Escribir una cédula matriculada y recibir el código |
| 6 | El correo sale | Que llegue el código al correo institucional |
| 7 | El certificado se genera | Pedirlo y comprobar el PDF adjunto |
| 8 | El QR verifica | Escanearlo: debe abrir `https://<TU-DOMINIO>/verificar/...` |
| 9 | El panel entra | Iniciar sesión y ver los tickets del rol |
| 10 | Se reporta una alerta | Con foto, y que llegue el aviso |
| 11 | Los puertos internos cerrados | Desde fuera, 5432 y 5678 no deben responder |

---

## 9. Copias de seguridad

Una vez en producción, programa un respaldo diario:

```bash
crontab -e
```

Añade:

```
0 2 * * * docker exec yavibot-postgres pg_dump -U yavibot -d yavibot > ~/respaldos/yavibot-$(date +\%F).sql
```

Crea antes la carpeta:

```bash
mkdir -p ~/respaldos
```
