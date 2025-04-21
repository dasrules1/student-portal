"use client"

import { useState, useEffect } from "react"
import { storage } from "./storage"

export function useStorage() {
  const [initialized, setInitialized] = useState(false)

  useEffect(() => {
    // Ensure storage is initialized
    const init = storage.ensureInitialized()
    setInitialized(init)
  }, [])

  // Return the storage instance with initialization status
  return storage
}
