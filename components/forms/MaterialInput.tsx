import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { IconAlertCircle, IconCheck, IconX } from '@tabler/icons-react';

interface MaterialInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: 'text' | 'email' | 'password' | 'number' | 'tel' | 'search';
  error?: string;
  helperText?: string;
  required?: boolean;
  disabled?: boolean;
  autoFocus?: boolean;
  maxLength?: number;
  showCharCount?: boolean;
  prefix?: React.ReactNode;
  suffix?: React.ReactNode;
  onClear?: () => void;
  className?: string;
  success?: boolean;
}

/**
 * Material Design 3 Input Component
 * Features:
 * - Floating label animation
 * - Outline variant
 * - Error state with shake animation
 * - Success state
 * - Character counter
 * - Prefix/suffix support
 * - Clear button
 */
const MaterialInput: React.FC<MaterialInputProps> = ({
  label,
  value,
  onChange,
  type = 'text',
  error,
  helperText,
  required = false,
  disabled = false,
  autoFocus = false,
  maxLength,
  showCharCount = false,
  prefix,
  suffix,
  onClear,
  className = '',
  success = false,
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const [shake, setShake] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const hasValue = value.length > 0;
  const isLabelFloating = isFocused || hasValue;

  // Shake animation on error
  useEffect(() => {
    if (error) {
      setShake(true);
      setTimeout(() => setShake(false), 500);
    }
  }, [error]);

  const handleClear = () => {
    onChange('');
    if (onClear) onClear();
    inputRef.current?.focus();
  };

  return (
    <div className={`relative ${className}`}>
      {/* Input Container */}
      <motion.div
        className={`relative border-2 rounded-lg transition-all ${
          error
            ? 'border-medical-red dark:border-red-500'
            : success
            ? 'border-medical-green dark:border-green-500'
            : isFocused
            ? 'border-medical-teal dark:border-sky-400'
            : 'border-slate-300 dark:border-slate-600'
        } ${disabled ? 'bg-slate-50 dark:bg-slate-800/50 cursor-not-allowed' : 'bg-white dark:bg-slate-800'}`}
        animate={shake ? { x: [-10, 10, -10, 10, 0] } : {}}
        transition={{ duration: 0.4 }}
      >
        {/* Floating Label */}
        <motion.label
          className={`absolute left-3 pointer-events-none origin-left transition-all ${
            error
              ? 'text-medical-red dark:text-red-400'
              : success
              ? 'text-medical-green dark:text-green-400'
              : isFocused
              ? 'text-medical-teal dark:text-sky-400'
              : 'text-slate-600 dark:text-slate-400'
          }`}
          animate={{
            y: isLabelFloating ? -28 : 12,
            scale: isLabelFloating ? 0.85 : 1,
            x: isLabelFloating ? -4 : 0,
          }}
          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
        >
          {label}
          {required && <span className="text-medical-red ml-0.5">*</span>}
        </motion.label>

        {/* Input Field */}
        <div className="flex items-center gap-2 px-3">
          {prefix && <span className="text-slate-600 dark:text-slate-400 flex-shrink-0">{prefix}</span>}

          <input
            ref={inputRef}
            type={type}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            disabled={disabled}
            autoFocus={autoFocus}
            maxLength={maxLength}
            className="flex-1 py-3 bg-transparent outline-none text-slate-900 dark:text-slate-100 disabled:cursor-not-allowed"
          />

          {/* Clear Button */}
          {hasValue && !disabled && onClear && (
            <motion.button
              type="button"
              onClick={handleClear}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
            >
              <IconX size={16} />
            </motion.button>
          )}

          {suffix && <span className="text-slate-600 dark:text-slate-400 flex-shrink-0">{suffix}</span>}

          {/* Success Icon */}
          {success && !error && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="text-medical-green"
            >
              <IconCheck size={20} />
            </motion.div>
          )}

          {/* Error Icon */}
          {error && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="text-medical-red"
            >
              <IconAlertCircle size={20} />
            </motion.div>
          )}
        </div>
      </motion.div>

      {/* Helper Text / Error Message / Character Count */}
      <div className="flex items-center justify-between mt-1 px-3">
        <AnimatePresence mode="wait">
          {error ? (
            <motion.p
              key="error"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="text-sm text-medical-red dark:text-red-400"
            >
              {error}
            </motion.p>
          ) : helperText ? (
            <motion.p
              key="helper"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-sm text-slate-600 dark:text-slate-400"
            >
              {helperText}
            </motion.p>
          ) : (
            <div />
          )}
        </AnimatePresence>

        {showCharCount && maxLength && (
          <span
            className={`text-xs ${
              value.length >= maxLength
                ? 'text-medical-red dark:text-red-400'
                : 'text-slate-500 dark:text-slate-400'
            }`}
          >
            {value.length} / {maxLength}
          </span>
        )}
      </div>
    </div>
  );
};

export default MaterialInput;
