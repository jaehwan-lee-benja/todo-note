import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import './App.css'

function App() {
  const [todos, setTodos] = useState([])
  const [inputValue, setInputValue] = useState('')
  const [loading, setLoading] = useState(true)

  // Fetch todos from Supabase on mount
  useEffect(() => {
    fetchTodos()
  }, [])

  const fetchTodos = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('todos')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      setTodos(data || [])
    } catch (error) {
      console.error('Error fetching todos:', error.message)
    } finally {
      setLoading(false)
    }
  }

  const handleAddTodo = async () => {
    if (inputValue.trim() === '') return

    try {
      const { data, error } = await supabase
        .from('todos')
        .insert([{ text: inputValue, completed: false }])
        .select()

      if (error) throw error
      setTodos([data[0], ...todos])
      setInputValue('')
    } catch (error) {
      console.error('Error adding todo:', error.message)
    }
  }

  const handleToggleTodo = async (id) => {
    const todo = todos.find(t => t.id === id)
    if (!todo) return

    try {
      const { error } = await supabase
        .from('todos')
        .update({ completed: !todo.completed })
        .eq('id', id)

      if (error) throw error
      setTodos(todos.map(t =>
        t.id === id ? { ...t, completed: !t.completed } : t
      ))
    } catch (error) {
      console.error('Error toggling todo:', error.message)
    }
  }

  const handleDeleteTodo = async (id) => {
    try {
      const { error } = await supabase
        .from('todos')
        .delete()
        .eq('id', id)

      if (error) throw error
      setTodos(todos.filter(todo => todo.id !== id))
    } catch (error) {
      console.error('Error deleting todo:', error.message)
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleAddTodo()
    }
  }

  return (
    <div className="app">
      <div className="container">
        <h1>📝 Todo Note</h1>

        <div className="input-section">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Add a new todo..."
            className="todo-input"
          />
          <button onClick={handleAddTodo} className="add-button">
            Add
          </button>
        </div>

        <div className="todo-list">
          {loading ? (
            <p className="empty-message">Loading todos...</p>
          ) : todos.length === 0 ? (
            <p className="empty-message">No todos yet. Add one to get started!</p>
          ) : (
            todos.map(todo => (
              <div key={todo.id} className={`todo-item ${todo.completed ? 'completed' : ''}`}>
                <input
                  type="checkbox"
                  checked={todo.completed}
                  onChange={() => handleToggleTodo(todo.id)}
                  className="todo-checkbox"
                />
                <span className="todo-text">{todo.text}</span>
                <button
                  onClick={() => handleDeleteTodo(todo.id)}
                  className="delete-button"
                >
                  Delete
                </button>
              </div>
            ))
          )}
        </div>

        <div className="todo-stats">
          <p>Total: {todos.length} | Completed: {todos.filter(t => t.completed).length}</p>
        </div>
      </div>
    </div>
  )
}

export default App
