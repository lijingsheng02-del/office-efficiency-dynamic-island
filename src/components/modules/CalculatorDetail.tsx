import { useMemo, useState } from 'react';
import { DetailShell } from './DetailShell';

type Operator = '+' | '-' | '*' | '/' | null;

type CalculatorDetailProps = {
  onBack: () => void;
  onClose: () => void;
};

const ERROR_TEXT = '错误';

function formatValue(value: number) {
  if (!Number.isFinite(value)) return ERROR_TEXT;
  const rounded = Math.round(value * 1_000_000_000) / 1_000_000_000;
  const text = String(rounded);
  return text.length > 11 ? rounded.toExponential(5) : text;
}

function calculate(left: number, right: number, operator: Operator) {
  if (operator === '+') return left + right;
  if (operator === '-') return left - right;
  if (operator === '*') return left * right;
  if (operator === '/') return right === 0 ? Number.NaN : left / right;
  return right;
}

export function CalculatorDetail({ onBack, onClose }: CalculatorDetailProps) {
  const [display, setDisplay] = useState('0');
  const [storedValue, setStoredValue] = useState<number | null>(null);
  const [operator, setOperator] = useState<Operator>(null);
  const [waitingForNext, setWaitingForNext] = useState(false);

  const expression = useMemo(() => {
    if (storedValue === null || !operator) return '快速计算';
    const symbol = operator === '*' ? '×' : operator === '/' ? '÷' : operator;
    return `${formatValue(storedValue)} ${symbol}`;
  }, [operator, storedValue]);

  const inputDigit = (digit: string) => {
    if (display === ERROR_TEXT || waitingForNext) {
      setDisplay(digit);
      setWaitingForNext(false);
      return;
    }

    setDisplay((current) => (current === '0' ? digit : `${current}${digit}`).slice(0, 11));
  };

  const inputDecimal = () => {
    if (display === ERROR_TEXT || waitingForNext) {
      setDisplay('0.');
      setWaitingForNext(false);
      return;
    }

    if (!display.includes('.')) setDisplay(`${display}.`);
  };

  const clear = () => {
    setDisplay('0');
    setStoredValue(null);
    setOperator(null);
    setWaitingForNext(false);
  };

  const toggleSign = () => {
    if (display === '0' || display === ERROR_TEXT) return;
    setDisplay((current) => (current.startsWith('-') ? current.slice(1) : `-${current}`));
  };

  const percent = () => {
    if (display === ERROR_TEXT) return;
    setDisplay(formatValue(Number(display) / 100));
  };

  const chooseOperator = (nextOperator: Operator) => {
    const inputValue = Number(display);

    if (storedValue === null) {
      setStoredValue(inputValue);
    } else if (!waitingForNext) {
      const result = calculate(storedValue, inputValue, operator);
      setDisplay(formatValue(result));
      setStoredValue(result);
    }

    setOperator(nextOperator);
    setWaitingForNext(true);
  };

  const equals = () => {
    if (storedValue === null || !operator) return;
    const result = calculate(storedValue, Number(display), operator);
    setDisplay(formatValue(result));
    setStoredValue(null);
    setOperator(null);
    setWaitingForNext(true);
  };

  return (
    <DetailShell title="计算器" onBack={onBack} onClose={onClose}>
      <section className="calculator-panel">
        <div className="calculator-display">
          <span>{expression}</span>
          <strong>{display}</strong>
        </div>

        <div className="calculator-keys" aria-label="计算器按键">
          <button type="button" className="utility" onClick={clear}>
            AC
          </button>
          <button type="button" className="utility" onClick={toggleSign}>
            +/-
          </button>
          <button type="button" className="utility" onClick={percent}>
            %
          </button>
          <button type="button" className="operator" onClick={() => chooseOperator('/')}>
            ÷
          </button>

          {['7', '8', '9'].map((digit) => (
            <button type="button" key={digit} onClick={() => inputDigit(digit)}>
              {digit}
            </button>
          ))}
          <button type="button" className="operator" onClick={() => chooseOperator('*')}>
            ×
          </button>

          {['4', '5', '6'].map((digit) => (
            <button type="button" key={digit} onClick={() => inputDigit(digit)}>
              {digit}
            </button>
          ))}
          <button type="button" className="operator" onClick={() => chooseOperator('-')}>
            -
          </button>

          {['1', '2', '3'].map((digit) => (
            <button type="button" key={digit} onClick={() => inputDigit(digit)}>
              {digit}
            </button>
          ))}
          <button type="button" className="operator" onClick={() => chooseOperator('+')}>
            +
          </button>

          <button type="button" className="zero" onClick={() => inputDigit('0')}>
            0
          </button>
          <button type="button" onClick={inputDecimal}>
            .
          </button>
          <button type="button" className="operator" onClick={equals}>
            =
          </button>
        </div>
      </section>
    </DetailShell>
  );
}
