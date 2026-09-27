const calculator = document.querySelector('.calculator');
const keypad = document.querySelector('.keypad');
const screen = document.querySelector('#screen');
const expression = document.querySelector('#expression');
const displayValue = document.querySelector('#display-value');
const screenMessage = document.querySelector('#screen-message');
const screenState = document.querySelector('#screen-state');
const serviceState = document.querySelector('#service-state');
const keys = document.querySelectorAll('.key');

const operationSymbols = {
  add: '+',
  subtract: '−',
  multiply: '×',
  divide: '÷',
  modulo: '%',
  power: '^',
};

let currentValue = '0';
let firstOperand = null;
let activeOperation = null;
let replaceOnDigit = false;

function renderDisplay() {
  displayValue.textContent = currentValue;
  const length = currentValue.length;
  displayValue.style.fontSize = length > 16 ? '22px' : length > 12 ? '30px' : length > 8 ? '38px' : '48px';
}

function setScreenState(label, isError = false) {
  screen.dataset.error = String(isError);
  screenState.textContent = label;
}

function appendDigit(digit) {
  if (replaceOnDigit || currentValue === '0') {
    currentValue = digit;
    replaceOnDigit = false;
  } else if (currentValue.replace('-', '').length < 18) {
    currentValue += digit;
  }
  renderDisplay();
}

function appendDecimal() {
  if (replaceOnDigit) {
    currentValue = '0.';
    replaceOnDigit = false;
  } else if (!currentValue.includes('.')) {
    currentValue += '.';
  }
  renderDisplay();
}

function clearCalculator() {
  currentValue = '0';
  firstOperand = null;
  activeOperation = null;
  replaceOnDigit = false;
  expression.textContent = 'Ready';
  screenMessage.textContent = 'Python worker connected';
  setScreenState('READY');
  renderDisplay();
}

function deleteDigit() {
  if (replaceOnDigit) {
    currentValue = '0';
    replaceOnDigit = false;
  } else {
    currentValue = currentValue.slice(0, -1);
    if (currentValue === '' || currentValue === '-') currentValue = '0';
  }
  renderDisplay();
}

function changeSign() {
  if (currentValue !== '0') {
    currentValue = currentValue.startsWith('-') ? currentValue.slice(1) : `-${currentValue}`;
    renderDisplay();
  }
}

async function requestCalculation(payload, formula) {
  keys.forEach((key) => { key.disabled = true; });
  setScreenState('WAIT');

  try {
    const response = await fetch('/api/calculate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await response.json();
    const result = data.python_result;

    if (!response.ok || result.status !== 'success') {
      expression.textContent = `${formula} =`;
      screenMessage.textContent = result.message || data.gateway_message || 'Calculation failed';
      setScreenState('ERROR', true);
      return false;
    }

    currentValue = String(result.result);
    replaceOnDigit = true;
    expression.textContent = `${formula} =`;
    screenMessage.textContent = result.message || 'Calculation completed';
    setScreenState('DONE');
    renderDisplay();
    return true;
  } catch (error) {
    expression.textContent = `${formula} =`;
    screenMessage.textContent = 'Could not reach the calculator service';
    setScreenState('ERROR', true);
    return false;
  } finally {
    keys.forEach((key) => { key.disabled = false; });
  }
}

async function chooseOperation(operation) {
  if (operation === 'square_root') {
    const formula = `√(${currentValue})`;
    await requestCalculation({ num1: Number(currentValue), operation }, formula);
    return;
  }

  if (firstOperand === null) {
    firstOperand = Number(currentValue);
  }
  activeOperation = operation;
  replaceOnDigit = true;
  expression.textContent = `${firstOperand} ${operationSymbols[operation]}`;
  screenMessage.textContent = 'Enter the next number';
  setScreenState('NEXT');
}

async function calculate() {
  if (firstOperand === null || activeOperation === null) return;

  const secondOperand = Number(currentValue);
  const formula = `${firstOperand} ${operationSymbols[activeOperation]} ${currentValue}`;
  const payload = { num1: firstOperand, num2: secondOperand, operation: activeOperation };
  await requestCalculation(payload, formula);
  firstOperand = null;
  activeOperation = null;
}

function activateKey(button) {
  if (button.dataset.digit !== undefined) {
    appendDigit(button.dataset.digit);
    return;
  }

  if (button.dataset.operation) {
    chooseOperation(button.dataset.operation);
    return;
  }

  const { action } = button.dataset;
  if (action === 'clear') clearCalculator();
  if (action === 'delete') deleteDigit();
  if (action === 'decimal') appendDecimal();
  if (action === 'sign') changeSign();
  if (action === 'equals') calculate();
}

keypad.addEventListener('click', (event) => {
  const button = event.target.closest('button.key');
  if (button && !button.disabled) activateKey(button);
});

document.addEventListener('keydown', (event) => {
  if (/^[0-9]$/.test(event.key)) {
    appendDigit(event.key);
  } else if (event.key === '.') {
    appendDecimal();
  } else if (event.key === 'Backspace') {
    deleteDigit();
  } else if (event.key === 'Escape') {
    clearCalculator();
  } else if (event.key === 'Enter' || event.key === '=') {
    calculate();
  } else {
    const operation = { '+': 'add', '-': 'subtract', '*': 'multiply', '/': 'divide', '%': 'modulo', '^': 'power' }[event.key];
    if (operation) chooseOperation(operation);
    else if (event.key.toLowerCase() === 'r') chooseOperation('square_root');
    else return;
  }
  event.preventDefault();
});

fetch('/api/status')
  .then((response) => response.json().then((data) => ({ response, data })))
  .then(({ response, data }) => {
    const online = response.ok && data.python_worker.status === 'ok';
    serviceState.dataset.online = String(online);
    serviceState.textContent = online ? 'Services online' : 'Worker unavailable';
    const dot = document.createElement('span');
    dot.className = 'state-dot';
    serviceState.prepend(dot);
  })
  .catch(() => {
    serviceState.dataset.online = 'false';
    serviceState.textContent = 'Worker unavailable';
    const dot = document.createElement('span');
    dot.className = 'state-dot';
    serviceState.prepend(dot);
  });

renderDisplay();