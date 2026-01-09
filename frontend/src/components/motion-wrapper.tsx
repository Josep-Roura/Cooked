"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";

/**
 * MotionWrapper
 *
 * Envuelve hijos con una animación de aparición / salida suave.
 * - keyId: le da una key estable a cada bloque para transiciones independientes.
 *
 * Requisitos:
 *   npm install framer-motion
 */
export function MotionWrapper({
  children,
  keyId
}: {
  children: React.ReactNode;
  keyId?: string;
}) {
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={keyId}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration: 0.25, ease: "easeOut" }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
