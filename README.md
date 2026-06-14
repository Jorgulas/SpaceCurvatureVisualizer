# Visualizador de Curvatura Gravítica 3D

App estática (sem build) que visualiza a deformação do espaço numa **grelha 3D**
sob a influência de corpos celestes. Move-te livremente, cria corpos e configura
o seu **volume**, **densidade** e **oscilação gravítica** — respeitando limites
físicos reais como o **buraco negro**, o **pulsar** e o hipotético **buraco branco**.

Construída com [Three.js](https://threejs.org/) via CDN (importmap). Não precisa
de Node, npm nem passo de build — basta servir os ficheiros.

## Controlos

| Tecla / ação | Efeito |
|---|---|
| `W` `A` `S` `D` | mover (ao longo do olhar) |
| `Espaço` / `Shift` | subir / descer |
| Rato | olhar em volta |
| Clique esquerdo | criar um corpo à frente da câmara |
| `E` | abrir/fechar o menu de parametrização |
| `R` | remover todos os corpos |
| `Z` | desfazer o último corpo |
| `Esc` | libertar o rato |

## Menu (tecla E)

O menu tem dois separadores:

- **Próximo corpo** — volume, densidade, oscilação e tipo (com predefinições);
  mostra ao vivo a massa, o raio de Schwarzschild e a classificação resultantes.
- **Grelha** — gere a visualização da rede:
  - **Alcance** (tamanho do cubo) e **Distância entre pontos** (densidade da rede);
    mostra os pontos por eixo e o nº de nós resultantes (limitado a 22³ por
    desempenho). Mudar estes dois reconstrói a grelha.
  - **Opacidade das linhas** e **Sensibilidade da cor** (a que ponto de
    deformação a cor satura).
  - **Cores**: calma (deformação baixa), intensa (deformação alta) e fundo.
  - **Mostrar caixa-limite** e **Repor predefinições**.

## Como funciona a física

Tudo em **unidades visuais** (não no SI), mas mantendo as *relações* reais:

- **Massa** `M = densidade × volume`
- **Raio do corpo** `R = ∛(3V / 4π)` (esfera)
- **Raio de Schwarzschild** `R_s = 2GM / c²` — tamanho a que a massa teria de ser
  comprimida para virar buraco negro
- **Compacidade** `C = R_s / R`:
  - `C ≥ 1` → **buraco negro** (a matéria está dentro do horizonte de eventos)
  - `0.3 ≤ C < 1` → **estrela de neutrões** (e **pulsar** se tiver oscilação/rotação)
  - `C < 0.3` → corpo normal (planeta/estrela)
- **Deformação da grelha**: cada nó é puxado para cada corpo com magnitude
  `G·M / (r + ε)`, limitada para não atravessar o centro. O **buraco branco** é
  repulsivo (empurra a grelha para fora).
- **Oscilação gravítica**: modula a profundidade do poço e emite ondulações
  radiais que viajam pela grelha (analogia simplificada a ondas gravitacionais).

A classificação (`Automático`) é calculada em tempo real no menu a partir do
volume e da densidade; também há predefinições com o tipo fixo.

## Correr localmente

Como usa módulos ES, abre através de um servidor (não com `file://`):

```bash
# qualquer um destes, a partir da pasta do projeto:
npx serve .
# ou
python -m http.server 8000
```

Depois abre `http://localhost:8000`.

## Publicar no GitHub Pages

1. Cria um repositório no GitHub e envia estes ficheiros para o ramo `main`:
   ```bash
   git init
   git add .
   git commit -m "Visualizador de curvatura gravítica 3D"
   git branch -M main
   git remote add origin https://github.com/<utilizador>/<repo>.git
   git push -u origin main
   ```
2. No GitHub: **Settings → Pages → Build and deployment**.
3. Em *Source* escolhe **Deploy from a branch**, ramo **main**, pasta **/ (root)**.
4. Guarda. Em ~1 min a app fica em `https://<utilizador>.github.io/<repo>/`.

O ficheiro `.nojekyll` garante que o GitHub Pages serve a pasta `src/` sem
processamento Jekyll.

## Estrutura

```
index.html        estrutura, importmap do Three.js, HUD e menu
styles.css        estilos da interface
src/main.js       arranque: cena, câmara, loop, ligação de tudo
src/SpaceGrid.js  rede 3D deformável
src/Body.js       corpo celeste (física + visual por tipo)
src/physics.js    constantes e fórmulas (massa, Schwarzschild, deformação)
src/Controls.js   câmara FPS (WASD + rato) e spawn
src/UI.js         menu de parametrização (tecla E) e HUD
```
