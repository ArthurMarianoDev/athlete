# Plano — Mapa satelital + Imagem estilo Strava

## O que será adicionado

1. **Mapa com imagem de satélite** nas telas onde a rota aparece grande:
   - Rastreamento ao vivo (a rota vai sendo desenhada sobre o satélite enquanto a pessoa se move).
   - Detalhes da atividade (rota completa sobre o satélite).
   - O mapa poderá ser ampliado e arrastado (zoom/pan) nessas telas.

2. **Imagem compartilhável estilo Strava**:
   - Ao tocar em **Compartilhar** (na tela de detalhes da atividade), o app gera uma imagem com o **fundo de satélite da região do percurso**, a **rota traçada em verde neon** por cima e os **dados do treino** (distância, tempo, ritmo/velocidade, calorias), além do **nome do atleta**, data, zona e a marca ZoneTrack.
   - Essa imagem é **salva na galeria** do celular **e** abre as **opções de compartilhamento** (WhatsApp, Instagram, etc.).

## Decisões já tomadas (podem ser contestadas)

- **Satélite sem nenhuma chave paga**: será usada uma fonte de imagens de satélite **gratuita e pública** (imagens tipo "World Imagery"), funcionando igual no iPhone e no Android, inclusive no Expo Go.
  - Consequência a validar: a imagem de satélite **não** é a do Google Earth nem a do Apple Maps. A cobertura e a nitidez em alguns lugares podem ser um pouco diferentes das desses apps. Em troca, **não é preciso criar conta nem chave de API** em lugar nenhum.

- **Onde o satélite aparece**: nas telas grandes (ao vivo e detalhes) e na imagem compartilhada. Nas **listas** (histórico do perfil e feed da zona), as miniaturas continuam com o traço leve da rota atual, para as listas rolarem rápido e sem travar. Se preferir satélite também nas miniaturas, é possível, mas as listas podem ficar mais pesadas.

- **Imagem compartilhada**: fundo de satélite + rota + dados, salva na galeria e com opção de compartilhar (conforme escolhido).

## Permissões e observações que o usuário precisa saber

- Para **salvar na galeria**, o app vai pedir permissão de acesso às **Fotos/Galeria** na primeira vez. Se for negada, aparece um caminho para liberar nas configurações.
- A **imagem compartilhada mostra o nome do atleta, a rota e os dados do treino** — ou seja, quem receber a imagem vê o trajeto percorrido. (É o mesmo comportamento do Strava.)
- **Só funciona 100% no celular real** (Expo Go ou build publicado): mapa satelital, salvar na galeria e compartilhar imagem. No **preview do navegador (web)** esses recursos ficam limitados ou indisponíveis.

## Fora do escopo (a menos que você peça)

- Trocar a fonte de satélite por Google Earth/Apple Maps (exigiria chave/config paga no Android).
- Satélite nas miniaturas das listas.
- Edição da imagem antes de compartilhar (adesivos, recorte, etc.).
