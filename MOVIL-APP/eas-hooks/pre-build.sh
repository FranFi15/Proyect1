set -e

if [ -n "$GOOGLE_SERVICES_JSON_BASE64" ]; then
    echo "Variable GOOGLE_SERVICES_JSON_BASE64 encontrada. Decodificando y creando google-services.json..."

    # 2. Define la ruta donde se debe crear el archivo para Android.
    ANDROID_GOOGLE_SERVICES_PATH="android/app/google-services.json"

    # 3. Decodifica el contenido del secret (que está en Base64) y lo escribe en el archivo.
    echo $GOOGLE_SERVICES_JSON_BASE64 | base64 -d > $ANDROID_GOOGLE_SERVICES_PATH

    echo "Archivo google-services.json creado exitosamente en $ANDROID_GOOGLE_SERVICES_PATH"
else
    echo "Advertencia: La variable GOOGLE_SERVICES_JSON_BASE64 no fue encontrada. Se omitió la creación del archivo."
fi