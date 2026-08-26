"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import styles from "./RotatingText.module.css";

interface RotatingTextProps {
  texts: string[];
  rotationInterval?: number;
  className?: string;
  preventWrap?: boolean;
}

interface AnimatedWord {
  characters: string[];
  characterOffset: number;
  needsSpace: boolean;
}

function splitIntoCharacters(text: string) {
  if (typeof Intl !== "undefined" && "Segmenter" in Intl) {
    const segmenter = new Intl.Segmenter(undefined, {
      granularity: "grapheme",
    });
    return Array.from(segmenter.segment(text), (segment) => segment.segment);
  }
  return Array.from(text);
}

export default function RotatingText({
  texts,
  rotationInterval = 3_200,
  className = "",
  preventWrap = false,
}: RotatingTextProps) {
  const prefersReducedMotion = useReducedMotion();
  const [currentIndex, setCurrentIndex] = useState(0);
  const currentText = texts[currentIndex] ?? texts[0] ?? "";

  const words = useMemo<AnimatedWord[]>(() => {
    const parts = currentText.split(" ");
    return parts.reduce<AnimatedWord[]>((animatedWords, word, index) => {
      const characters = splitIntoCharacters(word);
      const characterOffset = animatedWords.reduce(
        (total, animatedWord) => total + animatedWord.characters.length,
        0,
      );
      return [
        ...animatedWords,
        {
          characters,
          characterOffset,
          needsSpace: index < parts.length - 1,
        },
      ];
    }, []);
  }, [currentText]);

  const totalCharacters = words.reduce(
    (total, word) => total + word.characters.length,
    0,
  );

  useEffect(() => {
    if (prefersReducedMotion || texts.length < 2) return;
    const intervalId = window.setInterval(() => {
      setCurrentIndex((index) => (index + 1) % texts.length);
    }, rotationInterval);
    return () => window.clearInterval(intervalId);
  }, [prefersReducedMotion, rotationInterval, texts.length]);

  if (!currentText) return null;

  if (prefersReducedMotion) {
    return (
      <span
        className={`${styles.root} ${preventWrap ? styles.noWrap : ""} ${className}`.trim()}
      >
        {texts[0]}
      </span>
    );
  }

  return (
    <span
      className={`${styles.root} ${preventWrap ? styles.noWrap : ""} ${className}`.trim()}
    >
      <span className={styles.screenReaderText}>{currentText}</span>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={`${currentIndex}-${currentText}`}
          aria-hidden="true"
          className={styles.animatedText}
        >
          {words.map((word, wordIndex) => (
            <span
              key={`${wordIndex}-${word.characters.join("")}`}
              className={styles.word}
            >
              {word.characters.map((character, characterIndex) => {
                const globalIndex = word.characterOffset + characterIndex;
                return (
                  <motion.span
                    key={`${character}-${characterIndex}`}
                    initial={{ y: "85%", opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: "-85%", opacity: 0 }}
                    transition={{
                      type: "tween",
                      duration: 0.45,
                      ease: [0.22, 1, 0.36, 1],
                      delay: (totalCharacters - 1 - globalIndex) * 0.018,
                    }}
                    className={styles.character}
                  >
                    {character}
                  </motion.span>
                );
              })}
              {word.needsSpace && <span className={styles.space}> </span>}
            </span>
          ))}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}
