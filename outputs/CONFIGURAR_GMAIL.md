# Conectar Gmail a EJB MANAGER

La cuenta administradora de Santiago Jesús Villanueva Manrique ya tiene asociado `santiago241200@gmail.com`.
La conexión a Gmail requiere consentimiento de esa cuenta y un cliente OAuth de Google.

1. Abre https://console.cloud.google.com/ con esa cuenta y crea un proyecto llamado EJB Manager.
2. En APIs y servicios → Biblioteca, habilita Gmail API.
3. Configura Google Auth Platform: audiencia Externa, estado de pruebas y usuario de prueba `santiago241200@gmail.com`.
4. En Acceso a datos, añade `https://www.googleapis.com/auth/gmail.readonly` y `https://www.googleapis.com/auth/gmail.send`.
5. Crea un cliente OAuth para Aplicación web. Registra `http://localhost:4000/api/gmail/callback` como URI autorizada de redirección para esta instalación local.
6. Guarda en `C:\Proyecto Innovation Hub\backend\.env` las variables siguientes, usando los valores reales entregados por Google:

   ```
   GOOGLE_CLIENT_ID=<ID del cliente>
   GOOGLE_CLIENT_SECRET=<secreto del cliente>
   GOOGLE_REDIRECT_URI=http://localhost:4000/api/gmail/callback
   ```

   No copies el secreto en el código del frontend ni en el chat. La aplicación cifra los tokens usando el secreto del servidor.

7. Reinicia el backend. Para la conexión local abre EJB mediante `https://localhost:5173`, de modo que la autorización y el callback usen el mismo nombre de host.
8. En tu perfil, pulsa Actualizar → Conectar Gmail y acepta los permisos en Google. Cierra la ventana de autorización y pulsa Actualizar.

Para un dominio público, registra la URI HTTPS pública de `/api/gmail/callback` y actualiza GOOGLE_REDIRECT_URI para que coincida exactamente.
Mientras Google no esté configurado, EJB mostrará “Pendiente de configuración”.

Documentación oficial:
- https://developers.google.com/identity/protocols/oauth2/web-server
- https://developers.google.com/workspace/gmail/api/auth/scopes
