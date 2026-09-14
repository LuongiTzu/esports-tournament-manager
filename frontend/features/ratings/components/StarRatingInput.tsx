"use client";

import { useId } from "react";
import styles from "./StarRatingInput.module.css";

export default function StarRatingInput({
  value,
  onChange,
  label,
  disabled = false,
}: {
  value: number;
  onChange: (value: number) => void;
  label: string;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <fieldset disabled={disabled} className={styles.rating}>
      <legend className="text-sm font-medium text-ink-muted">{label}</legend>
      <div className={styles.stars}>
        {[1, 2, 3, 4, 5].map((score) => (
          <span
            key={score}
            className={styles.star}
            data-filled={score <= value}
          >
            <input
              className={styles.input}
              type="radio"
              id={`${id}-${score}`}
              name={`${id}-score`}
              value={score}
              checked={value === score}
              onChange={() => onChange(score)}
              aria-label={`${score} / 5`}
            />
            <label htmlFor={`${id}-${score}`} className={styles.label}>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  pathLength={360}
                  d="M12,17.27L18.18,21L16.54,13.97L22,9.24L14.81,8.62L12,2L9.19,8.62L2,9.24L7.45,13.97L5.82,21L12,17.27Z"
                />
              </svg>
            </label>
          </span>
        ))}
      </div>
    </fieldset>
  );
}
