(async () => {
    let API_BASE = window.API_BASE || '/api';

    // Dynamically determine API base if not set
    if (!window.API_BASE) {
        try {
            const response = await fetch('/api/config');
            if (response.ok) {
                const config = await response.json();
                if (config.port) {
                    API_BASE = `http://${window.location.hostname}:${config.port}/api`;
                }
            }
        } catch (error) {
            console.warn('Failed to fetch API config, using default:', error);
        }
    }

    const startOptions = document.getElementById('start-options');
    const createGameBtn = document.getElementById('create-game-btn');
    const joinGameBtn = document.getElementById('join-game-btn');
    const lengthForm = document.getElementById('length-form');
    const lengthSelect = document.getElementById('length');
    const attemptsForm = document.getElementById('attempts-form');
    const attemptsSelect = document.getElementById('attempts');
    const prefixForm = document.getElementById('prefix-form');
    const prefixInput = document.getElementById('prefix-input');
    const joinForm = document.getElementById('join-form');
    const joinCodeInput = document.getElementById('join-code');
    const suggestionsPanel = document.getElementById('suggestions-panel');
    const suggestionsSelect = document.getElementById('suggestions');
    const gameSection = document.getElementById('game-section');
        const backBtn = document.getElementById('back-btn');
    const boardEl = document.getElementById('board');
    const shareCodeDiv = document.getElementById('share-code');
    const codeText = document.getElementById('code-text');
    const errorBox = document.getElementById('error-box');
    const possibilitiesBox = document.getElementById('possibilities');
    const solverStatus = document.getElementById('solver-status');
    const gameResult = document.getElementById('game-result');
    const newGameLink = document.getElementById('new-game-link');
    const solveFastBtn = document.getElementById('solve-fast');
    const solveEfficientBtn = document.getElementById('solve-efficient');
    const shareGameBtn = document.getElementById('share-game');
    const guessForm = document.getElementById('guess-form');

    // Navigation state management
    const SCREENS = {
        START: 'start',
        LENGTH: 'length',
        ATTEMPTS: 'attempts',
        PREFIX: 'prefix',
        JOIN: 'join',
        GAME: 'game',
    };

    // Navigation stack for back button
    let navStack = [];

    // Restore navStack from localStorage if available
    function saveNavStack() {
        localStorage.setItem('navStack', JSON.stringify(navStack));
    }
    function loadNavStack() {
        try {
            const stack = JSON.parse(localStorage.getItem('navStack'));
            if (Array.isArray(stack)) {
                navStack = stack;
            }
        } catch (e) { navStack = []; }
    }

    function showScreen(screen) {
        // Hide all
        startOptions.classList.add('hidden');
        lengthForm.classList.add('hidden');
        attemptsForm.classList.add('hidden');
        prefixForm.classList.add('hidden');
        joinForm.classList.add('hidden');
        gameSection.classList.add('hidden');
        backBtn.classList.add('hidden');

        // Show relevant
        if (screen === SCREENS.START) {
            startOptions.classList.remove('hidden');
        } else if (screen === SCREENS.LENGTH) {
            lengthForm.classList.remove('hidden');
            backBtn.classList.remove('hidden');
        } else if (screen === SCREENS.ATTEMPTS) {
            attemptsForm.classList.remove('hidden');
            backBtn.classList.remove('hidden');
        } else if (screen === SCREENS.PREFIX) {
            prefixForm.classList.remove('hidden');
            backBtn.classList.remove('hidden');
        } else if (screen === SCREENS.JOIN) {
            joinForm.classList.remove('hidden');
            backBtn.classList.remove('hidden');
        } else if (screen === SCREENS.GAME) {
            gameSection.classList.remove('hidden');
        }
        // Save current screen to localStorage
        localStorage.setItem('currentScreen', screen);
    }

    function getCurrentScreen() {
        return localStorage.getItem('currentScreen') || SCREENS.START;
    }

    function navigateTo(screen) {
        const current = getCurrentScreen();
        if (current !== screen) {
            navStack.push(current);
            saveNavStack();
        }
        showScreen(screen);
    }

    function navigateBack() {
        if (navStack.length > 0) {
            const prev = navStack.pop();
            saveNavStack();
            showScreen(prev);
        } else {
            showScreen(SCREENS.START);
        }
    }

    // Initial screen flow handlers
    function showCreateGameFlow() {
        navigateTo(SCREENS.LENGTH);
    }

    function showJoinGameFlow() {
        navigateTo(SCREENS.JOIN);
    }

    function handleJoinFormSubmit(event) {
        event.preventDefault();
        const code = joinCodeInput.value.trim().toUpperCase();
        if (!code) {
            setManualError('Please enter a game code.');
            return;
        }
        // Fetch the shared game state
        postJson('/join', {code: code}).then(function(state) {
            if (state && state.sessionId) {
                localStorage.setItem('sessionId', state.sessionId);
            }
            localStorage.setItem('shareCode', code);
            localStorage.setItem('guesses', '[]');
            applyState(state);
            navigateTo(SCREENS.GAME);
        }).catch(function(error) {
            console.error(error);
            setManualError('Invalid or expired game code.');
        });
    }


        let currentLength = Number(lengthSelect?.value || 5);
        let currentAttempts = Number(attemptsSelect?.value || 6);
        let currentState = null;
        let currentGuess = '';
        let manualError = '';
        let submitInFlight = false;
        let solverInFlight = false;
        let suggestionsTimer = null;    const LETTER_REGEX = /^[a-zA-Z]$/;

    function setManualError(message) {
        manualError = message;
        if (currentState) {
            applyState(currentState);
        } else {
            updateErrorBox(message);
        }
    }

    function clearSuggestions() {
        suggestionsSelect.innerHTML = '';
        suggestionsPanel.classList.add('hidden');
    }

    function updateSuggestions(words) {
        suggestionsSelect.innerHTML = '';
        if (!words || words.length === 0) {
            suggestionsPanel.classList.add('hidden');
            return;
        }
        const fragment = document.createDocumentFragment();
        words.forEach((word) => {
            const option = document.createElement('option');
            option.value = word;
            option.textContent = word.toUpperCase();
            fragment.appendChild(option);
        });
        suggestionsSelect.appendChild(fragment);
        suggestionsSelect.selectedIndex = 0;
        suggestionsPanel.classList.remove('hidden');
    }

async function fetchSuggestions(prefix) {
    clearTimeout(suggestionsTimer);
    if (!prefix) {
        clearSuggestions();
        return;
    }

    suggestionsTimer = setTimeout(function() {
        const params = new URLSearchParams();
        params.set('length', String(currentLength));
        params.set('prefix', prefix);
        fetch(`${API_BASE}/suggestions?${params.toString()}`, {
            method: 'GET',
            cache: 'no-store'
        }).then(function(response) {
            if (!response.ok) {
                throw new Error(`Failed to fetch suggestions (${response.status})`);
            }
            return response.json();
        }).then(function(words) {
            updateSuggestions(words);
        }).catch(function(error) {
            console.error(error);
            setManualError('Unable to fetch word suggestions.');
        });
    }, 200);
}    function updateErrorBox(message) {
        if (message) {
            errorBox.textContent = message;
            errorBox.classList.remove('hidden');
        } else {
            errorBox.textContent = '';
            errorBox.classList.add('hidden');
        }
    }

    function updatePossibilities(state) {
        if (!state || !state.gameActive) {
            possibilitiesBox.textContent = '';
            possibilitiesBox.classList.add('hidden');
            return;
        }
        const text = state.possibilities != null
            ? `Remaining possibilities: ${Number(state.possibilities).toLocaleString()}`
            : '';
        if (text) {
            possibilitiesBox.textContent = text;
            possibilitiesBox.classList.remove('hidden');
        } else {
            possibilitiesBox.textContent = '';
            possibilitiesBox.classList.add('hidden');
        }
    }

    function updateSolverStatus(message) {
        if (message) {
            solverStatus.textContent = message;
            solverStatus.classList.remove('hidden');
        } else {
            solverStatus.textContent = '';
            solverStatus.classList.add('hidden');
        }
    }

    function updateGameResult(state) {
        if (!state || !state.isGameOver) {
            gameResult.innerHTML = '';
            gameResult.classList.add('hidden');
            newGameLink.classList.add('hidden');
            return;
        }

        const guessCount = Array.isArray(state.guesses) ? state.guesses.length : 0;
        if (state.isWon) {
            gameResult.innerHTML = `<h2>Victory!</h2><p>Solved in ${guessCount} guess${guessCount === 1 ? '' : 'es'}.</p>`;
        } else {
            const reveal = state.secretWord ? state.secretWord.toUpperCase() : 'UNKNOWN';
            gameResult.innerHTML = `<h2>Game Over</h2><p>The word was ${reveal}.</p>`;
        }
        if (state.remainingAttempts != null) {
            gameResult.innerHTML += `<p>Remaining attempts: ${state.remainingAttempts}</p>`;
        }
        gameResult.classList.remove('hidden');
        newGameLink.classList.remove('hidden');
    }

    function updateShareCode(state) {
        if (state && state.shareCode) {
            codeText.textContent = state.shareCode;
            shareCodeDiv.classList.remove('hidden');
        } else {
            shareCodeDiv.classList.add('hidden');
        }
    }

    function ensureBoardSizing(state) {
        if (!state) {
            boardEl.classList.add('normal-width');
            boardEl.classList.remove('long-word');
            return;
        }
        if (state.wordLength > 10) {
            boardEl.classList.add('long-word');
            boardEl.classList.remove('normal-width');
        } else {
            boardEl.classList.add('normal-width');
            boardEl.classList.remove('long-word');
        }
    }

    function renderBoard(state) {
        boardEl.innerHTML = '';
        if (!state) {
            return;
        }

        const attempts = state.maxAttempts || 0;
        const width = state.wordLength || 0;
        const guesses = Array.isArray(state.guesses) ? state.guesses : [];
        const activeRow = state.isGameOver ? -1 : guesses.length;

        for (let rowIndex = 0; rowIndex < attempts; rowIndex += 1) {
            const rowEl = document.createElement('div');
            rowEl.className = 'row';

            const guess = guesses[rowIndex] || null;
            const letters = guess && typeof guess.word === 'string' ? guess.word : '';
            const feedback = guess && Array.isArray(guess.feedback) ? guess.feedback : [];

            for (let colIndex = 0; colIndex < width; colIndex += 1) {
                const cell = document.createElement('div');
                cell.classList.add('cell');

                let letter = '';
                if (guess && colIndex < letters.length) {
                    letter = letters[colIndex];
                    cell.classList.add('filled');
                } else if (rowIndex === activeRow && colIndex < currentGuess.length) {
                    letter = currentGuess[colIndex];
                    cell.classList.add('filled');
                } else {
                    cell.classList.add('empty');
                }

                if (guess && colIndex < feedback.length) {
                    const color = feedback[colIndex];
                    if (color === 'green' || color === 'yellow' || color === 'grey') {
                        cell.classList.add(color);
                    }
                }

                cell.textContent = letter;
                rowEl.appendChild(cell);
            }

            boardEl.appendChild(rowEl);
        }
    }

    function applyState(state) {
        currentState = state;
        ensureBoardSizing(state);
        renderBoard(state);

        const errorMessage = manualError || (state && state.error) || '';
        updateErrorBox(errorMessage);
        manualError = '';

        updatePossibilities(state);
        updateGameResult(state);
        updateShareCode(state);

        if (state && state.gameActive) {
            shareGameBtn.classList.add('hidden');
        } else {
            shareGameBtn.classList.remove('hidden');
        }

        if (state && state.gameActive && !state.isGameOver) {
            updateSolverStatus('Type your guess and press Enter.');
            gameSection.classList.remove('hidden');
            guessForm.classList.remove('hidden');
        } else if (state && state.gameActive && state.isGameOver) {
            updateSolverStatus('Game complete. Start a new game to play again.');
            gameSection.classList.remove('hidden');
            guessForm.classList.add('hidden');
        } else {
            updateSolverStatus('Select a word to start a new game.');
            gameSection.classList.add('hidden');
            guessForm.classList.add('hidden');
            currentGuess = '';
        }
    }

    async function refreshState() {
        try {
            // Get session_id from localStorage
            const sessionId = localStorage.getItem('sessionId');
            if (!sessionId) {
                // No session, show empty state
                applyState({ gameActive: false });
                return;
            }
            
            const response = await fetch(`${API_BASE}/state?session_id=${encodeURIComponent(sessionId)}`, { cache: 'no-store' });
            if (!response.ok) {
                throw new Error(`State request failed (${response.status})`);
            }
            const state = await response.json();
            const previousGuesses = currentState && Array.isArray(currentState.guesses)
                ? currentState.guesses.length
                : 0;
            applyState(state);
            const updatedGuesses = Array.isArray(state.guesses) ? state.guesses.length : 0;
            if (updatedGuesses > previousGuesses) {
                currentGuess = '';
            }
        } catch (error) {
            console.error(error);
            setManualError('Unable to reach the backend service.');
        }
    }

async function postForm(path, params) {
    const response = await fetch(`${API_BASE}${path}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: params.toString(),
        cache: 'no-store'
    });
    if (!response.ok) {
        throw new Error(`Request failed (${response.status})`);
    }
    return response.json();
}

function postJson(path, data) {
    return fetch(`${API_BASE}${path}`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(data),
        cache: 'no-store'
    }).then(response => {
        return response.json().then(json => {
            if (!response.ok) {
                throw new Error(json.error || `Request failed (${response.status})`);
            }
            return json;
        });
    });
}    function handleLengthSubmit(event) {
        event.preventDefault();
        currentLength = Number(lengthSelect.value) || 5;
        navigateTo(SCREENS.ATTEMPTS);
        attemptsSelect.focus();
    }

    function handleAttemptsSubmit(event) {
        event.preventDefault();
        currentAttempts = Number(attemptsSelect.value) || 6;
        navigateTo(SCREENS.PREFIX);
        prefixInput.focus();
        // Render a blank board with the selected number of attempts and current word length
        renderBoard({
            maxAttempts: currentAttempts,
            wordLength: currentLength,
            guesses: [],
            isGameOver: false
        });
    }

    function getSelectedSuggestion() {
        const option = suggestionsSelect.options[suggestionsSelect.selectedIndex];
        return option ? option.value : '';
    }

    async function handlePrefixSubmit(event) {
        event.preventDefault();
        const selectedWord = getSelectedSuggestion();
        if (!selectedWord) {
            setManualError('Select a word from the list to start the game.');
            return;
        }

        const params = new URLSearchParams();
        params.set('length', String(currentLength));
        params.set('attempts', String(currentAttempts));
        params.set('word', selectedWord);

        try {
            const result = await postForm('/start', params);
            // Store session_id and shareCode from response
            if (result.sessionId) {
                localStorage.setItem('sessionId', result.sessionId);
            }
            if (result.shareCode) {
                localStorage.setItem('shareCode', result.shareCode);
            }
            clearSuggestions();
            prefixInput.value = '';
            navigateTo(SCREENS.GAME);
            await refreshState();
        } catch (error) {
            console.error(error);
            setManualError('Unable to start the game. Please try again.');
        }
    }

    async function resetGame() {
        const params = new URLSearchParams();
        try {
            await postForm('/reset', params);
        } catch (error) {
            console.error(error);
            setManualError('Unable to reset the game.');
            return;
        }
        currentGuess = '';
        lengthForm.reset();
        attemptsForm.reset();
        prefixInput.value = '';
        clearSuggestions();
        currentLength = Number(lengthSelect.value) || 5;
        currentAttempts = Number(attemptsSelect.value) || 6;
        // Clear navigation stack and session data
        navStack = [];
        saveNavStack();
        localStorage.removeItem('sessionId');
        localStorage.removeItem('shareCode');
        localStorage.removeItem('guesses');
        navigateTo(SCREENS.START);
        // Render a blank board with the current selection
        renderBoard({
            maxAttempts: currentAttempts,
            wordLength: currentLength,
            guesses: [],
            isGameOver: false
        });
        await refreshState();
    }

    function handleGlobalKeydown(event) {
        if (!currentState || !currentState.gameActive || currentState.isGameOver) {
            return;
        }

        const activeElement = document.activeElement;
        if (activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'SELECT')) {
            return;
        }

        if (event.key === 'Enter') {
            if (currentGuess.length === (currentState.wordLength || 0)) {
                event.preventDefault();
                submitGuess();
            }
            return;
        }

        if (event.key === 'Backspace') {
            if (currentGuess.length > 0) {
                currentGuess = currentGuess.slice(0, -1);
                renderBoard(currentState);
            }
            return;
        }

        if (LETTER_REGEX.test(event.key)) {
            if (currentGuess.length < (currentState.wordLength || 0)) {
                currentGuess += event.key.toUpperCase();
                renderBoard(currentState);
            }
        }
    }

    async function submitGuess() {
        if (submitInFlight || !currentState || currentState.isGameOver) {
            return;
        }
        if (currentGuess.length !== (currentState.wordLength || 0)) {
            setManualError(`Enter a ${currentState.wordLength}-letter word.`);
            return;
        }

        submitInFlight = true;
        const params = new URLSearchParams();
        const sessionId = localStorage.getItem('sessionId');
        if (!sessionId) {
            setManualError('No active session. Please start a new game.');
            submitInFlight = false;
            return;
        }
        params.set('session_id', sessionId);
        params.set('guess', currentGuess.toLowerCase());
        try {
            await postForm('/guess', params);
            currentGuess = '';
            await refreshState();
            localStorage.setItem('guesses', JSON.stringify(currentState.guesses));
        } catch (error) {
            console.error(error);
            setManualError('Guess failed. Check the word and try again.');
        } finally {
            submitInFlight = false;
        }
    }

    async function runSolver(type) {
        if (solverInFlight || !currentState || !currentState.gameActive || currentState.isGameOver) {
            return;
        }
        solverInFlight = true;
        updateSolverStatus(`Running ${type === 'efficient' ? 'efficient' : 'fast'} solver...`);
        const params = new URLSearchParams();
        params.set('type', type);
        const sessionId = localStorage.getItem('sessionId');
        if (!sessionId) {
            setManualError('No active session. Please start a new game.');
            solverInFlight = false;
            return;
        }
        params.set('session_id', sessionId);
        try {
            await postForm('/solve', params);
            await refreshState();
        } catch (error) {
            console.error(error);
            setManualError('Solver request failed.');
        } finally {
            solverInFlight = false;
        }
    }

    async function shareGame() {
        if (!currentState || !currentState.gameActive) {
            setManualError('No active game to share.');
            return;
        }
        if (currentState.shareCode) {
            setManualError(`Game already shared! Code: ${currentState.shareCode} (expires in 1 hour)`);
            return;
        }
        try {
            const response = await fetch(`${API_BASE}/share`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                body: ''
            });
            if (!response.ok) {
                throw new Error(`Share failed (${response.status})`);
            }
            const data = await response.json();
            const code = data.code;
            // Update state with code
            currentState.shareCode = code;
            updateShareCode(currentState);
            setManualError(`Game shared! Code: ${code} (expires in 1 hour)`);
        } catch (error) {
            console.error(error);
            setManualError('Failed to share game.');
        }
    }

    function handlePrefixInput(event) {
        const prefix = event.target.value;
        fetchSuggestions(prefix);
    }

    function attachEventHandlers() {
        if (createGameBtn) {
            createGameBtn.addEventListener('click', showCreateGameFlow);
        }
        if (joinGameBtn) {
            joinGameBtn.addEventListener('click', showJoinGameFlow);
        }
        if (joinForm) {
            joinForm.addEventListener('submit', handleJoinFormSubmit);
        }
        backBtn.addEventListener('click', navigateBack);
        lengthForm.addEventListener('submit', handleLengthSubmit);
        attemptsForm.addEventListener('submit', handleAttemptsSubmit);
        prefixInput.addEventListener('input', handlePrefixInput);
        prefixForm.addEventListener('submit', handlePrefixSubmit);
        newGameLink.addEventListener('click', (event) => {
            event.preventDefault();
            resetGame();
        });
        solveFastBtn.addEventListener('click', () => runSolver('fast'));
        solveEfficientBtn.addEventListener('click', () => runSolver('efficient'));
        shareGameBtn.addEventListener('click', shareGame);
        window.addEventListener('keydown', handleGlobalKeydown);
        if (suggestionsSelect) {
            suggestionsSelect.addEventListener('dblclick', () => {
                const selectedWord = getSelectedSuggestion();
                if (selectedWord) {
                    if (typeof prefixForm.requestSubmit === 'function') {
                        prefixForm.requestSubmit();
                    } else {
                        prefixForm.dispatchEvent(new Event('submit', { cancelable: true }));
                    }
                }
            });
        }
    }

    attachEventHandlers();
    // Restore last screen and navStack on load
    loadNavStack();
    const initialScreen = getCurrentScreen();
    const shareCode = localStorage.getItem('shareCode');
    if (initialScreen === SCREENS.GAME && shareCode) {
        postJson('/join', {code: shareCode}).then(state => {
            applyState(state);
            const localGuesses = JSON.parse(localStorage.getItem('guesses') || '[]');
            if (localGuesses.length > 0 && (!Array.isArray(state.guesses) || state.guesses.length === 0)) {
                state.guesses = localGuesses;
                renderBoard(state);
            }
        }).catch(() => {
            showScreen(SCREENS.START);
        });
    } else {
        showScreen(initialScreen);
    }
})();
