import React, { useState } from 'react'

function renderTabChildren(children, props) {
  return React.Children.map(children, (child) => {
    if (!React.isValidElement(child)) return child

    const childProps = child.props?.children
      ? { ...props, children: renderTabChildren(child.props.children, props) }
      : props

    return React.cloneElement(child, {
      ...props,
      ...child.props,
      ...childProps,
    })
  })
}

export function Tabs({ children, value, defaultValue, onValueChange }) {
  const [internalValue, setInternalValue] = useState(defaultValue)
  const isControlled = value !== undefined
  const activeValue = isControlled ? value : internalValue

  const setValue = (nextValue) => {
    if (!isControlled) {
      setInternalValue(nextValue)
    }
    onValueChange?.(nextValue)
  }

  return <div>{renderTabChildren(children, { activeValue, setValue })}</div>
}

export function TabsList({ children, className, ...props }) {
  const resolvedClassName = [
    'flex flex-nowrap items-center gap-1 overflow-x-auto rounded-lg border bg-white p-1 shadow-sm',
    className,
  ].filter(Boolean).join(' ')

  return (
    <div className={resolvedClassName} {...props}>
      {children}
    </div>
  )
}

export function TabsTrigger({ children, value, activeValue, setValue, className }) {
  const isActive = activeValue === value
  const resolvedClassName = [
    'flex shrink-0 items-center gap-2 whitespace-nowrap rounded-md px-4 py-2 text-sm font-medium transition-all',
    isActive ? 'bg-teal-50 text-teal-700 shadow-sm' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-800',
    className,
  ].filter(Boolean).join(' ')

  return (
    <button
      onClick={() => setValue(value)}
      className={resolvedClassName}
    >
      {children}
    </button>
  )
}

export function TabsContent({ children, value, activeValue }) {
  if (activeValue !== value) return null
  return <div className="space-y-4">{children}</div>
}
