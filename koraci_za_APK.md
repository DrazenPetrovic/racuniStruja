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

---

## Korak po korak

### 1. Build web aplikacije

```powershell
npm run build
```

### 2. Sync sa Android projektom

```powershell
npx cap sync android
```

### 3. Napravi APK

```powershell
cd android
.\gradlew.bat assembleDebug
```

### 4. Vrati se u root folder

```powershell
cd ..
```

---

## Prvi build na novom računaru

Napravi `android\local.properties` (nije u gitu):

```
sdk.dir=C:/Users/Korisnik/AppData/Local/Android/Sdk
```

---

## Instalacija na telefonu

1. Kopiraj `app-debug.apk` na telefon (USB ili Google Drive)
2. Otvori APK i dozvoli instalaciju iz nepoznatih izvora
3. Prijavi se korisničkim imenom i lozinkom iz serverskog `.env` fajla (`APP_USERNAME` i lozinka za koju je napravljen `APP_PASSWORD_HASH`)

---

## Napomene

- **Debug APK** — dovoljan za ličnu upotrebu, potpisuje se automatski
- **Release APK** (optimizovaniji, ali nepotpisan, pa se ne može instalirati dok se ne potpiše):

  ```CMD
  npm run build && npx cap sync android && cd android && .\gradlew.bat assembleRelease
  ```

  Lokacija: `android\app\build\outputs\apk\release\app-release-unsigned.apk`

- Komande sa `&&` rade u CMD-u, ali ne i u Windows PowerShellu 5.1
- Ako Gradle prijavi grešku, očisti cache:
  ```powershell
  cd android; .\gradlew.bat clean; .\gradlew.bat assembleDebug
  ```
- Ako build padne sa greškom `InternalProblems`, Gradle je nadograđen na 9.6 ili noviji, a projekat treba 8.14.3. Vrati ga komandom:
  ```powershell
  git restore android/gradle/wrapper/gradle-wrapper.properties
  ```
