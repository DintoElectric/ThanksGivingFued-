# Thanksgiving Family Feud

A bright, autumn-themed Family Feud game board for a Thanksgiving get-together. Static site, no build step, no backend. It is a separate copy of the Holiday Family Feud game, so the two can live in two different repos and Netlify sites.

## Files (all go in the repo root, no folders)

- `index.html` – the page, including the winking turkey in a Dinto hard hat and the Pilgrim plugging in the autumn tree lights
- `styles.css` – the bright autumn theme and animations
- `app.js` – game logic, sounds, question editor, Fast Money
- `netlify.toml` – tells Netlify to publish the repo root

## Deploy

1. Create a new GitHub repo and upload the four files plus this README (Add file → Upload files).
2. In Netlify: Add new site → Import from GitHub → pick the repo.
3. Build command: leave empty. Publish directory: `.` (netlify.toml already sets this).

## Before the game

1. Open **Set up questions**. The game uses 12 questions, listed in play order. You can untick any, edit them, or add your own.
2. Tally the survey, then for each question open it and either type the answers and vote counts or use **Paste survey results**.
3. Question 1 has sample answers so the board looks alive. Replace them with the real results.
4. Your questions, answers, and scores are saved in the browser you use. To move them to the laptop you’ll use for the game, use **Export backup** here and **Import backup** there.

## Running the game

- Pick which team is in control, click answers as they’re guessed (or press 1–8), press Strike for misses.
- After 3 strikes the other team can steal; the status bar tells you what to do.
- Award the round to a team, then Next question. Double and Triple points are in the Play card.
- **Fast Money** is in the top bar: two players, 20 and 25 second timers, 200-point goal.
- **Finish game** shows the winner.
- **Music:** gentle autumn music-box pieces play softly after you press Start, shuffled on a loop. Use the Music button and Volume slider in the top bar. The Sound button mutes everything, and the music dips under the buzzer and fanfare.
- **Your own sound effects:** drop `correct.mp3` (plays on each right answer) and/or `strike.mp3` (plays on each strike) into the repo root and the game uses them in place of the built-in sounds. Use only files you have the rights to play.
- **Your own music:** drop a licensed or royalty-free `music.mp3` into the repo root (next to index.html) and the game plays it on a loop instead of the built-in music. Only use tracks you have the rights to play.
- **Hard hat logo:** the turkey wears a hard hat with a text “DINTO” badge. To use the real logo, add `dinto-logo.png` (or `dinto-logo.svg`) to the repo root; it replaces the text automatically.

Shortcuts: 1–8 reveal, X strike, ← → change question, F full screen, M sound.
