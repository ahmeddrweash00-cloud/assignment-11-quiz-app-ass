export default class Quiz {
  constructor(category, difficulty, numberOfQuestions, playerName) {
    this.category = category;
    this.difficulty = difficulty;
    this.numberOfQuestions = Number(numberOfQuestions);
    this.playerName = playerName || "Player";
    this.score = 0;
    this.questions = [];
    this.currentQuestionIndex = 0;
  }

  async getQuestions() {
    const response = await fetch(this.buildApiUrl());

    if (!response.ok) {
      throw new Error(`Failed to load questions (HTTP ${response.status}).`);
    }

    const data = await response.json();

    if (data.response_code !== 0) {
      throw new Error(
        "Questions could not be loaded. Try a different category or difficulty."
      );
    }

    this.questions = data.results;
    return this.questions;
  }

  buildApiUrl() {
    const url = new URL("https://opentdb.com/api.php?amount=10");
    url.searchParams.set("amount", String(this.numberOfQuestions));
    url.searchParams.set("difficulty", this.difficulty);
    url.searchParams.set("type", "multiple");

    if (this.category) {
      url.searchParams.set("category", this.category);
    }

    return url.toString();
  }

  incrementScore() {
    this.score += 1;
  }

  playCorrectAnswerSound() {
    this.playSound([720, 831, 988], 0.1);
  }

  playWrongAnswerSound() {
    this.playSound([392, 350, 233], 0.14);
  }

  playWarningMelody(secondsRemaining) {
    if (!this.audioContext || this.audioContext.state !== "running") return;

    try {
      const startTime = this.audioContext.currentTime;
      const melody = [587, 698, 784, 698, 880, 784, 698, 587];
      const noteCount = 6 - secondsRemaining;

      for (let index = 0; index < noteCount; index += 1) {
        const noteStart = startTime + index * 0.1;
        const frequency = melody[(5 - secondsRemaining + index) % melody.length];
        const volume = this.audioContext.createGain();
        const accordionTone = this.audioContext.createOscillator();
        const brightTone = this.audioContext.createOscillator();

        accordionTone.type = "sawtooth";
        accordionTone.frequency.setValueAtTime(frequency, noteStart);
        brightTone.type = "triangle";
        brightTone.frequency.setValueAtTime(frequency * 2, noteStart);
        volume.gain.setValueAtTime(0.0001, noteStart);
        volume.gain.linearRampToValueAtTime(0.055, noteStart + 0.012);
        volume.gain.exponentialRampToValueAtTime(0.0001, noteStart + 0.085);

        accordionTone.connect(volume);
        brightTone.connect(volume);
        volume.connect(this.audioContext.destination);
        accordionTone.start(noteStart);
        brightTone.start(noteStart);
        accordionTone.stop(noteStart + 0.09);
        brightTone.stop(noteStart + 0.09);
      }
    } catch (error) {
      console.error("Unable to play the countdown melody:", error);
    }
  }

  playTimeUpSound() {
    if (!this.audioContext || this.audioContext.state !== "running") return;

    try {
      const startTime = this.audioContext.currentTime;
      const oscillator = this.audioContext.createOscillator();
      const volume = this.audioContext.createGain();

      oscillator.type = "triangle";
      oscillator.frequency.setValueAtTime(180, startTime);
      oscillator.frequency.exponentialRampToValueAtTime(45, startTime + 0.45);
      volume.gain.setValueAtTime(0.0001, startTime);
      volume.gain.linearRampToValueAtTime(0.45, startTime + 0.025);
      volume.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.5);

      oscillator.connect(volume);
      volume.connect(this.audioContext.destination);
      oscillator.start(startTime);
      oscillator.stop(startTime + 0.5);
    } catch (error) {
      console.error("Unable to play the time-up sound:", error);
    }
  }

  playResultsSound() {
    this.playSound([723, 659, 784, 1046], 0.14);
  }

  playSound(frequencies, noteDuration) {
    if (!this.audioContext || this.audioContext.state !== "running") return;

    try {
      const startTime = this.audioContext.currentTime;

      frequencies.forEach((frequency, index) => {
        const noteStart = startTime + index * noteDuration;
        const oscillator = this.audioContext.createOscillator();
        const volume = this.audioContext.createGain();

        oscillator.type = "sine";
        oscillator.frequency.setValueAtTime(frequency, noteStart);
        volume.gain.setValueAtTime(0.0001, noteStart);
        volume.gain.linearRampToValueAtTime(0.1, noteStart + 0.015);
        volume.gain.exponentialRampToValueAtTime(
          0.0001,
          noteStart + noteDuration
        );

        oscillator.connect(volume);
        volume.connect(this.audioContext.destination);
        oscillator.start(noteStart);
        oscillator.stop(noteStart + noteDuration);
      });
    } catch (error) {
      console.error("Unable to play the quiz sound:", error);
    }
  }

  getCurrentQuestion() {
    return this.questions[this.currentQuestionIndex] ?? null;
  }

  nextQuestion() {
    if (this.currentQuestionIndex < this.questions.length) {
      this.currentQuestionIndex += 1;
    }

    return !this.isComplete();
  }

  isComplete() {
    return this.currentQuestionIndex >= this.questions.length;
  }

  getScorePercentage() {
    if (!this.numberOfQuestions) return 0;
    return Math.round((this.score / this.numberOfQuestions) * 100);
  }

  saveHighScore() {
    const scores = this.getHighScores();

    scores.push({
      name: this.playerName,
      score: this.score,
      total: this.numberOfQuestions,
      percentage: this.getScorePercentage(),
      difficulty: this.difficulty,
      date: new Date().toISOString(),
    });

    scores.sort((a, b) => b.percentage - a.percentage);
    const topScores = scores.slice(0, 10);

    try {
      localStorage.setItem("quizHighScores", JSON.stringify(topScores));
    } catch {
      // Storage may be unavailable or full; the quiz results can still display.
    }
  }

  getHighScores() {
    try {
      const stored = localStorage.getItem("quizHighScores");
      const scores = stored ? JSON.parse(stored) : [];
      return Array.isArray(scores) ? scores : [];
    } catch {
      return [];
    }
  }

  isHighScore() {
    const scores = this.getHighScores();

    if (scores.length < 10) return true;

    const lowestScore = Math.min(...scores.map((entry) => entry.percentage));
    return this.getScorePercentage() > lowestScore;
  }

  endQuiz() {
    const percentage = this.getScorePercentage();
    const newRecord = this.isHighScore();

    if (newRecord) {
      this.saveHighScore();
    }

    const highScores = this.getHighScores();
    const leaderboardHTML = highScores
      .slice(0, 10)
      .map(
        (entry, index) => `
          <li class="leaderboard-item ${["gold", "silver", "bronze"][index] || ""}">
            <span class="leaderboard-rank">#${index + 1}</span>
            <span class="leaderboard-name">${this.escapeHtml(entry.name)}</span>
            <span class="leaderboard-score">${entry.percentage}%</span>
          </li>
        `
      )
      .join("");

    return `
      <div class="game-card results-card">
        <h2 class="results-title">Quiz Complete!</h2>
        <p class="results-score-display">${this.score}/${this.numberOfQuestions}</p>
        <p class="results-percentage">${percentage}% Accuracy</p>

        ${
          newRecord
            ? `<div class="new-record-badge">
                 <i class="fa-solid fa-star"></i> New High Score!
               </div>`
            : ""
        }

        <div class="leaderboard">
          <h4 class="leaderboard-title">
            <i class="fa-solid fa-trophy"></i> Leaderboard
          </h4>
          <ul class="leaderboard-list">${leaderboardHTML}</ul>
        </div>

        <div class="action-buttons">
          <button type="button" class="btn-restart">
            <i class="fa-solid fa-rotate-right"></i> Play Again
          </button>
        </div>
      </div>
    `;
  }

  escapeHtml(value) {
    const element = document.createElement("span");
    element.textContent = String(value ?? "");
    return element.innerHTML;
  }
}