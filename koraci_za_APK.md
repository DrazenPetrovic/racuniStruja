# Koraci za pravljenje APK fajla

## Brza komanda (sve u jednom)

```CMD
npm run build && npx cap sync android && cd android && .\gradlew.bat assembleDebug
```

`npm run build` uzima adresu servera iz `.env.production` (`https://karpas.app/struja`).

## APK lokacija nakon builda

```
android\app\build\outputs\apk\debug\app-debug.apk
```

## Prvi build na novom računaru

Napravi `android\local.properties` (nije u gitu):

```
sdk.dir=C:/Users/Korisnik/AppData/Local/Android/Sdk
```

## Instalacija na telefonu

1. Kopiraj `app-debug.apk` na telefon (USB ili Google Drive)
2. Otvori APK i dozvoli instalaciju iz nepoznatih izvora
3. Prijavi se korisničkim imenom i lozinkom iz serverskog `.env` fajla (`APP_USERNAME` i lozinka za koju je napravljen `APP_PASSWORD_HASH`)

## Napomene

- Ako Gradle prijavi grešku, očisti cache:
  ```powershell
  cd android; .\gradlew.bat clean; .\gradlew.bat assembleDebug
  ```
