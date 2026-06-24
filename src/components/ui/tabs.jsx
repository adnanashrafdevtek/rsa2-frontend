import React, { useState } from 'react'

export function Tabs({ children, defaultValue }) {
  const [value, setValue] = useState(defaultValue)
  return (
    <div>
      {React.Children.map(children, child =>
        child && React.cloneElement(child, { activeValue: value, setValue })
      )}
    </div>
  )
}

export function TabsList({ children, ...props }) {
  return (
    <div className="bg-white border shadow-sm rounded-lg p-1 inline-flex flex-wrap gap-1 overflow-x-auto" {...props}>
      {children}
    </div>
  )
}

export function TabsTrigger({ children, value, activeValue, setValue }) {
  const isActive = activeValue === value
  return (
    <button
      onClick={() => setValue(value)}
      className={`
        px-4 py-2 rounded-md text-sm font-medium transition-all flex items-center gap-2
        ${isActive
          ? 'bg-teal-50 text-teal-700 shadow-sm'
          : 'text-slate-600 hover:bg-slate-50 hover:text-slate-800'
        }
      `}
    >
      {children}
    </button>
  )
}

export function TabsContent({ children, value, activeValue }) {
  if (activeValue !== value) return null
  return <div className="space-y-4">{children}</div>
}
