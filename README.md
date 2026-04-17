# GrammarFlux
🚀 GrammarFlux — CFG Simplification Engine
A browser-based tool for analyzing and simplifying Context-Free Grammars (CFGs) using standard formal language algorithms, with full visibility into each transformation step.

🧠 Overview
GrammarFlux is built to bridge the gap between theoretical concepts in TOC and practical understanding. It provides a controlled environment to parse grammars, execute simplification algorithms, and observe internal state changes in real time.

⚙️ Core Capabilities
Parse and validate user-defined CFG input
Execute core simplification algorithms:
Null (ε) production elimination
Unit production elimination
Useless symbol removal (generating + reachable)
Step-wise execution with optional sequential pipeline
Real-time transformation trace with system-level logging
Dual-pane visualization (input state vs output state)
Interactive editing utilities (epsilon insertion, rule formatting)
Theme switching (dark/light mode)

🧱 Architecture
The application is structured around a modular grammar engine:

Grammar Class
Encapsulates rules using Map<Variable, Set<Productions>>
Provides transformation methods for each simplification phase
Ensures immutability through controlled cloning
Execution Pipeline
Independent or sequential phase execution
State transitions managed explicitly between steps
Logger System
Captures system actions, eliminations, and substitutions
Provides transparency into algorithm decisions
UI Layer
Split-pane layout for input and output comparison
Dynamic rendering of grammar structures
Live trace console for debugging and learning
🛠️ Tech Stack
HTML5 — semantic structure
CSS3 — custom UI system (no frameworks)
Vanilla JavaScript — core logic and algorithms

No external libraries or dependencies.

▶️ Usage
Enter grammar rules using standard CFG notation
Initialize parsing
Execute simplification phases individually or in sequence
Observe rule transformations and system logs in real time

📌 Design Focus
Clarity over abstraction — every transformation is visible
Deterministic behavior — no hidden state mutations
Minimal dependencies — fully self-contained system
Algorithm-first approach — UI supports logic, not the other way around

⚠️ Constraints
Supports only single-character variables (A–Z)
Designed for educational and analytical use, not production parsing
Limited to core CFG simplification (no normal form conversions)


