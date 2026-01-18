# Snake Game

A responsive Snake game built with vanilla JavaScript and MySQL backend.

## Quick Start

```bash
npm install
npx vercel dev
```

Game available at `http://localhost:3000`

## Features

- Classic Snake gameplay
- Three difficulty levels (Easy, Normal, Hard)
- Progressive difficulty
- High score tracking
- Touch controls for mobile
- Keyboard controls (Arrow keys / WASD)
- Sound effects

## Database Setup

Create MySQL table:

```sql
CREATE TABLE highscores (
  difficulty VARCHAR(20) PRIMARY KEY,
  score INT NOT NULL
);
```

Set environment variable:

```
DATABASE_URL=mysql://username:password@host:port/database
```

## Tech Stack

- Frontend: Vanilla JavaScript
- Backend: Vercel Serverless Functions
- Database: MySQL
