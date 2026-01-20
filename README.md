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

You can run the included setup script:

```bash
mysql -u username -p database < database_setup.sql
```

Or execute this SQL directly:

```sql
CREATE TABLE leaderboard (
  id INT AUTO_INCREMENT PRIMARY KEY,
  player_name VARCHAR(50) NOT NULL,
  score INT NOT NULL,
  difficulty VARCHAR(20) NOT NULL,
  device_type VARCHAR(20) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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
