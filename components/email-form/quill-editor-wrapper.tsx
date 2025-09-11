"use client"

import dynamic from 'next/dynamic'
import React from 'react'

// Placeholder component shown during loading
const LoadingPlaceholder = () => (
  <div className="border rounded-md">
    <div className="h-16 bg-muted animate-pulse border-b" />
    <div className="h-80 bg-background animate-pulse" />
  </div>
)

// Dynamically import the QuillEditor with no SSR
const QuillEditor = dynamic(
  () => import('./quill-editor'),
  { 
    ssr: false,
    loading: () => <LoadingPlaceholder />
  }
)

export default QuillEditor