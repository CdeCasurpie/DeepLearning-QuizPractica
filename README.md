# DeepLearning-QuizPractica

Simulador interactivo de Deep Learning para practicar — versión web estática, lista para **GitHub Pages**.

Port de `practica.py` (20 aleatorias + métricas) y `examen.py` (banco completo barajado) a HTML/CSS/JS sin backend.

## Contenido

| Archivo | Descripción |
|---|---|
| `index.html` | UI: inicio, quiz, resultados |
| `styles.css` | Tema oscuro, responsive |
| `app.js` | Lógica del quiz + métricas (port de `calculate_metrics`) |
| `quiz_data.json` | Banco de 146 preguntas con `$...$` en LaTeX |

## Modos

- **Práctica:** N preguntas aleatorias (10/20/30/50, default 20).
- **Examen:** banco completo barajado (146).
- Opción de barajar opciones por pregunta. Atajos: `a–e` para responder, `Enter` para siguiente.

## Fórmulas

Render con [KaTeX](https://katex.org) vía CDN. El texto mezcla HTML plano + `$...$`,
igual que `MathRenderer`/`draw_mixed_text` en `practica.py`.

## Métricas (al final, en memoria)

- Accuracy, precision macro, recall macro, F1 macro
- Matriz de confusión (clase = letra de respuesta A/B/C/…)
- Tabla por clase (TP/FP/FN/TN)
- Tiempo medio de respuesta + repaso de falladas con la correcta

No hay persistencia: a propósito, es solo para practicar.

## Correr local

```bash
cd DeepLearning-QuizPractica
python3 -m http.server 8000
# abrir http://localhost:8000
```

> Abrir `index.html` directo con `file://` falla el `fetch` del JSON; usa el servidor de arriba.

## Publicar en GitHub Pages

1. Sube esta carpeta como contenido del repo `DeepLearning-QuizPractica` (o cópiala a la raíz).
2. En GitHub: **Settings → Pages → Deploy from a branch → `main` / `/ (root)`**.
3. La URL queda `https://<usuario>.github.io/DeepLearning-QuizPractica/`.

## Origen

- `practica.py`: Pygame + Matplotlib MathText, 20 preguntas, guarda `quiz_metrics_temp.json` + `quiz_history.jsonl`.
- `examen.py`: Pygame, todo el banco barajado, sin métricas.
- Esta web conserva la lógica de ambos y reemplaza el render Matplotlib por KaTeX.
