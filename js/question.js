export default class Question {
  constructor(quiz, container, onQuizEnd = null) {
    this.quiz = quiz;
    this.container = container;
    this.onQuizEnd = onQuizEnd;
    this.questionData = quiz.getCurrentQuestion();
    this.index = quiz.currentQuestionIndex;

    this.question = this.decodeHtml(this.questionData.question);
    this.correctAnswer = this.decodeHtml(this.questionData.correct_answer);
    this.category = this.decodeHtml(this.questionData.category);
    this.wrongAnswers = this.questionData.incorrect_answers.map((answer) =>
      this.decodeHtml(answer)
    );

    this.allAnswers = this.shuffleAnswers();
    this.answered = false;
    this.timerInterval = null;
    this.timeRemaining = 15;
    this.audioContext = quiz.audioContext;
    this.keyboardHandler = null;
  }

  decodeHtml(html) {
    const doc = new DOMParser().parseFromString(html, "text/html");
    return doc.documentElement.textContent;
  }

  shuffleAnswers() {
    const answers = [...this.wrongAnswers, this.correctAnswer];

    for (let i = answers.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [answers[i], answers[j]] = [answers[j], answers[i]];
    }

    return answers;
  }

  getProgress() {
    return Math.round(
      ((this.index + 1) / this.quiz.numberOfQuestions) * 100
    );
  }

  displayQuestion() {
    const difficulty = this.questionData.difficulty.toLowerCase();
    const difficultyIcon = {
      easy: "fa-face-smile",
      medium: "fa-face-meh",
      hard: "fa-skull",
    }[difficulty] || "fa-gauge-high";

    const answersHTML = this.allAnswers
      .map(
        (answer, index) => `
          <button type="button" class="answer-btn" data-answer="${this.escapeHtml(answer)}">
            <span class="answer-key">${index + 1}</span>
            <span class="answer-text">${this.escapeHtml(answer)}</span>
          </button>
        `
      )
      .join("");

    this.container.innerHTML = `
      <div class="game-card question-card">
        <div class="xp-bar-container">
          <div class="xp-bar-header">
            <span class="xp-label"><i class="fa-solid fa-bolt"></i> Progress</span>
            <span class="xp-value">Question ${this.index + 1}/${this.quiz.numberOfQuestions}</span>
          </div>
          <div class="xp-bar">
            <div class="xp-bar-fill" style="width: ${this.getProgress()}%"></div>
          </div>
        </div>

        <div class="stats-row">
          <div class="stat-badge category">
            <i class="fa-solid fa-bookmark"></i>
            <span>${this.escapeHtml(this.category)}</span>
          </div>
          <div class="stat-badge difficulty ${difficulty}">
            <i class="fa-solid ${difficultyIcon}"></i>
            <span>${this.escapeHtml(difficulty)}</span>
          </div>
          <div class="stat-badge timer" aria-live="polite" aria-label="Time remaining">
            <i class="fa-solid fa-stopwatch"></i>
            <span class="timer-value">${this.timeRemaining}</span>s
          </div>
          <div class="stat-badge counter">
            <i class="fa-solid fa-gamepad"></i>
            <span>${this.index + 1}/${this.quiz.numberOfQuestions}</span>
          </div>
        </div>

        <h2 class="question-text">${this.escapeHtml(this.question)}</h2>

        <div class="answers-grid">
          ${answersHTML}
        </div>

        <p class="keyboard-hint">
          <i class="fa-regular fa-keyboard"></i> Press 1-4 to select
        </p>

        <div class="score-panel">
          <div class="score-item">
            <div class="score-item-label">Score</div>
            <div class="score-item-value">${this.quiz.score ?? 0}</div>
          </div>
        </div>
      </div>
    `;

    this.addEventListeners();
    this.startTimer();
  }

  escapeHtml(value) {
    const element = document.createElement("span");
    element.textContent = value;
    return element.innerHTML;
  }

  addEventListeners() {
    this.container.querySelectorAll(".answer-btn").forEach((button) => {
      button.addEventListener("click", () => this.checkAnswer(button));
    });

    this.keyboardHandler = (event) => {
      if (!["1", "2", "3", "4"].includes(event.key) || this.answered) {
        return;
      }

      const button = this.container.querySelectorAll(".answer-btn")[
        Number(event.key) - 1
      ];

      if (button) {
        this.checkAnswer(button);
      }
    };

    document.addEventListener("keydown", this.keyboardHandler);
  }

  removeEventListeners() {
    if (this.keyboardHandler) {
      document.removeEventListener("keydown", this.keyboardHandler);
      this.keyboardHandler = null;
    }
  }

  startTimer() {
    const timerDisplay = this.container.querySelector(".timer-value");

    this.timerInterval = setInterval(() => {
      this.timeRemaining -= 1;

      if (timerDisplay) {
        timerDisplay.textContent = this.timeRemaining;
      }

      if (this.timeRemaining <= 5 && this.timeRemaining > 0) {
        const timer = this.container.querySelector(".timer");
        timer?.classList.add("warning", "critical");
        this.quiz.playWarningMelody(this.timeRemaining);
      }

      if (this.timeRemaining <= 0) {
        this.stopTimer();
        this.handleTimeUp();
      }
    }, 1000);
  }

  stopTimer() {
    clearInterval(this.timerInterval);
    this.timerInterval = null;
  }

  handleTimeUp() {
    if (this.answered) return;

    this.answered = true;
    this.removeEventListeners();
    this.highlightCorrectAnswer();
    this.quiz.playTimeUpSound();

    const card = this.container.querySelector(".question-card");
    if (card) {
      const message = document.createElement("div");
      message.className = "time-up-message";
      message.innerHTML = '<i class="fa-solid fa-clock"></i> TIME’S UP!';
      card.appendChild(message);
    }

    this.container.querySelectorAll(".answer-btn").forEach((button) => {
      button.classList.add("disabled");
    });

    this.animateQuestion(300);
  }

  checkAnswer(choiceElement) {
    if (this.answered) return;

    this.answered = true;
    this.stopTimer();
    this.removeEventListeners();

    const selectedAnswer = choiceElement.dataset.answer;
    const isCorrect =
      selectedAnswer.toLowerCase() === this.correctAnswer.toLowerCase();

    if (isCorrect) {
      choiceElement.classList.add("correct");
      this.quiz.incrementScore();
      this.quiz.playCorrectAnswerSound();
    } else {
      choiceElement.classList.add("wrong");
      this.highlightCorrectAnswer();
      this.quiz.playWrongAnswerSound();
    }

    this.container.querySelectorAll(".answer-btn").forEach((button) => {
      if (button !== choiceElement && !button.classList.contains("correct-reveal")) {
        button.classList.add("disabled");
      }
    });

    const scoreDisplay = this.container.querySelector(".score-item-value");
    if (scoreDisplay) {
      scoreDisplay.textContent = this.quiz.score ?? 0;
    }

    this.animateQuestion(300);
  }

  highlightCorrectAnswer() {
    this.container.querySelectorAll(".answer-btn").forEach((button) => {
      if (
        button.dataset.answer.toLowerCase() ===
        this.correctAnswer.toLowerCase()
      ) {
        button.classList.add("correct-reveal");
      }
    });
  }

  getNextQuestion() {
    if (this.quiz.nextQuestion()) {
      const nextQuestion = new Question(
        this.quiz,
        this.container,
        this.onQuizEnd
      );
      nextQuestion.displayQuestion();
      return;
    }

    if (typeof this.onQuizEnd === "function") {
      this.onQuizEnd(this.quiz);
    } else if (typeof this.quiz.endQuiz === "function") {
      this.quiz.endQuiz();
    }
  }

  animateQuestion(duration = 300) {
    setTimeout(() => {
      const card = this.container.querySelector(".question-card");
      card?.classList.add("exit");

      setTimeout(() => this.getNextQuestion(), duration);
    }, 1500);
  }
}