# API - ejemplos rápidos

Base URL: `http://localhost:4000/api`

## Registro

```http
POST /auth/register
Content-Type: application/json

{
  "fullName": "Persona Demo",
  "email": "persona@example.com",
  "password": "Clave1234"
}
```

## Evento

```http
POST /profiles/{profileId}/events
Authorization: Bearer ACCESS_TOKEN
Content-Type: application/json

{
  "eventType": "LAB_RESULT",
  "title": "Hemograma - registro de ejemplo",
  "eventDate": "2026-08-28",
  "description": "Dato de demostración",
  "source": "Laboratorio de ejemplo",
  "details": {
    "test_name": "Prueba de ejemplo",
    "value_text": "Valor de ejemplo",
    "unit": "unidad",
    "reference_range": "rango informado por laboratorio"
  }
}
```

## Filtros

```http
GET /profiles/{profileId}/events?type=LAB_RESULT&from=2026-01-01&to=2026-12-31&q=laboratorio&page=1&pageSize=20
```

## Documento

`multipart/form-data` con campos:

- `file`: PDF/JPG/PNG/WEBP.
- `eventId`: UUID opcional.

## IA

```http
POST /profiles/{profileId}/ai/analyze
Authorization: Bearer ACCESS_TOKEN
Content-Type: application/json

{
  "eventIds": ["uuid-1", "uuid-2"],
  "purpose": "Preparar una revisión informativa antes de una consulta"
}
```
