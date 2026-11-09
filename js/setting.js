import Quiz from './quiz.js';
import Question from './question.js';

export class setting {
  constructor() {
    this.playerName = document.getElementById('playerName');
    this.category = document.getElementById('categoryMenu');
    this.difficulty = document.getElementById('difficultyOptions');
    this.questionsNumber = document.getElementById('questionsNumber');
    this.startQuizBtn = document.getElementById('startQuiz');
    this.form = document.getElementById('quizOptions');
    this.formError = document.querySelector('.form-error');
    this.questionsContainer = document.getElementById('questionsContainer');
    this.currentQuiz = null;

    this.startQuizBtn.addEventListener('click', () => this.startQuiz());
    this.form.addEventListener('submit', event => {
      event.preventDefault();
      this.startQuiz();
    });
    this.questionsNumber.addEventListener('input', () => {
      if (this.isValidNumber()) this.formError.classList.remove('show');
    });
  }

  isValidNumber() {
    const value = this.questionsNumber.value.trim();
    const number = Number(value);
    return value !== '' && Number.isInteger(number) && number >= 1 && number <= 50;
  }

  async startQuiz() {
    if (!this.isValidNumber()) {
      this.formError.classList.add('show');
      this.questionsNumber.focus();
      return;
    }

    this.prepareTimerSound();
    this.formError.classList.remove('show');
    this.startQuizBtn.disabled = true;
    this.form.classList.add('hidden');
    this.questionsContainer.innerHTML = `
      <div class="loading-overlay" role="status">
        <div class="loading-spinner"></div>
        <p class="loading-text">Loading Questions...</p>
      </div>`;

    this.currentQuiz = new Quiz(
      this.category.value,
      this.difficulty.value,
      Number(this.questionsNumber.value),
      this.playerName.value.trim() || 'Player'
    );
    this.currentQuiz.audioContext = this.audioContext;

    try {
      const questions = await this.currentQuiz.getQuestions();
      if (!questions.length) {
        throw new Error('No questions found for these settings. Try a different category or difficulty.');
      }

      this.showQuestions();
    } catch (error) {
      console.error('Unable to load quiz questions:', error);
      const message = error instanceof Error ? error.message : 'An unexpected error occurred.';
      this.questionsContainer.innerHTML = `
        <div class="game-card error-card">
          <div class="error-icon"><i class="fa-solid fa-triangle-exclamation"></i></div>
          <h3 class="error-title">Oops! Something went wrong</h3>
          <p class="error-message">${this.escapeHtml(message)}</p>
          <button class="btn-play retry-btn" type="button">
            <i class="fa-solid fa-rotate-right"></i> Try Again
          </button>
        </div>`;
      this.questionsContainer.querySelector('.retry-btn').addEventListener('click', () => {
        this.questionsContainer.innerHTML = '';
        this.form.classList.remove('hidden');
        this.startQuizBtn.disabled = false;
      });
    }
  }

  prepareTimerSound() {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;

    try {
      this.audioContext = this.audioContext || new AudioContextClass();
      this.audioContext.resume().catch(error => {
        console.error('Unable to enable the quiz timer sound:', error);
      });
    } catch (error) {
      console.error('Unable to initialize the quiz timer sound:', error);
    }
  }

  showQuestions() {
    const question = new Question(
      this.currentQuiz,
      this.questionsContainer,
      quiz => this.showResults(quiz)
    );
    question.displayQuestion();
  }

  showResults(quiz) {
    this.questionsContainer.innerHTML = quiz.endQuiz();
    quiz.playResultsSound();
    this.questionsContainer.querySelector('.btn-restart').addEventListener('click', () => {
      this.questionsContainer.innerHTML = '';
      this.form.classList.remove('hidden');
      this.startQuizBtn.disabled = false;
      this.questionsNumber.focus();
    });
  }

  escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, character => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    })[character]);
  }
}
