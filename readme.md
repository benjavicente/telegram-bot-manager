# Bot Manager para el DCC

Bot manager busca ser una herramienta para dejar multiples bots de 
telegram corriendo en un mismo servidor, con la posibilidad de 
administrarlos desde telegram.

Utiliza pocketbase para datos persistentes, y fly.io para el deploy.

## Deploy

Al crear la aplicación con fly.io:

```sh
fly ips allocate-v4
```
