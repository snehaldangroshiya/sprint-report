# Contributing to NextReleaseMCP

Thank you for your interest in contributing to NextReleaseMCP! This document provides guidelines and instructions for contributing.

## 🚀 Getting Started

1. **Fork the repository** on GitHub
2. **Clone your fork** locally
3. **Create a branch** for your changes
4. **Make your changes** following our guidelines
5. **Test your changes** thoroughly
6. **Submit a pull request**

## 📋 Development Setup

```bash
# Clone your fork
git clone https://github.com/YOUR_USERNAME/nextrelease-mcp.git
cd nextrelease-mcp

# Install dependencies
npm install
cd web && npm install && cd ..

# Set up environment
cp .env.example .env
# Edit .env with your credentials

# Start development servers
npm run dev:web          # Terminal 1: MCP + API Server
cd web && npm run dev    # Terminal 2: Web App
```

## 🎯 Development Workflow

### 1. Create a Feature Branch

```bash
git checkout -b feature/your-feature-name
# or
git checkout -b fix/your-bug-fix
```

### 2. Make Your Changes

- Write clean, readable code
- Follow the existing code style
- Add tests for new functionality
- Update documentation as needed

### 3. Run Tests

```bash
npm run test              # Unit tests
npm run type-check        # TypeScript validation
npm run lint              # Code linting
```

### 4. Commit Your Changes

We use [Conventional Commits](https://www.conventionalcommits.org/):

```bash
# Format: <type>(<scope>): <description>
git commit -m "feat(api): add sprint velocity endpoint"
git commit -m "fix(cache): resolve Redis connection timeout"
git commit -m "docs(readme): update installation instructions"
```

**Commit Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

### 5. Push and Create PR

```bash
git push origin feature/your-feature-name
```

Then create a Pull Request on GitHub.

## 📝 Code Style Guidelines

### TypeScript/JavaScript

- Use **TypeScript** for all new code
- Follow **2-space indentation**
- Use **single quotes** for strings
- **100 characters** max line length
- Use **async/await** over promises
- Add **JSDoc comments** for public APIs

### File Organization

- Place business logic in `/src/services/`
- Place API endpoints in `/src/web/`
- Place utilities in `/src/utils/`
- Place tests next to source files or in `/__tests__/`

### Naming Conventions

- **Files**: kebab-case (`sprint-service.ts`)
- **Classes**: PascalCase (`SprintService`)
- **Functions**: camelCase (`getSprintData`)
- **Constants**: UPPER_SNAKE_CASE (`MAX_RETRIES`)

## ✅ Pull Request Guidelines

### Before Submitting

- [ ] Code follows style guidelines
- [ ] All tests pass
- [ ] TypeScript compiles without errors
- [ ] Documentation is updated
- [ ] Commits follow conventional commits format
- [ ] Branch is up to date with main

### PR Description Template

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
- [ ] Unit tests added/updated
- [ ] Integration tests added/updated
- [ ] Manual testing performed

## Checklist
- [ ] Code follows style guidelines
- [ ] Self-review completed
- [ ] Documentation updated
- [ ] No new warnings
```

## 🧪 Testing Guidelines

### Unit Tests

```typescript
// Use Jest for unit tests
describe('SprintService', () => {
  it('should calculate velocity correctly', () => {
    // Arrange
    const sprint = createMockSprint();

    // Act
    const velocity = calculateVelocity(sprint);

    // Assert
    expect(velocity).toBe(147);
  });
});
```

### Integration Tests

```typescript
// Test complete workflows
it('should generate sprint report successfully', async () => {
  const report = await generateSprintReport(sprintId);
  expect(report).toBeDefined();
  expect(report.format).toBe('html');
});
```

## 📖 Documentation

- Update README.md for significant changes
- Add JSDoc comments for new functions/classes
- Update CLAUDE.md for architecture changes
- Create docs/*.md for new features

## 🐛 Bug Reports

When filing a bug report, include:

1. **Description**: Clear description of the bug
2. **Steps to Reproduce**: Detailed steps
3. **Expected Behavior**: What should happen
4. **Actual Behavior**: What actually happens
5. **Environment**: Node version, OS, etc.
6. **Screenshots**: If applicable

## 💡 Feature Requests

When suggesting features:

1. **Use Case**: Explain why this is needed
2. **Description**: What the feature should do
3. **Examples**: How it would work
4. **Alternatives**: Other approaches considered

## 🔒 Security Issues

**Do not** open public issues for security vulnerabilities.
Instead, email security concerns to the maintainers.

## 📜 Code of Conduct

- Be respectful and inclusive
- Welcome newcomers
- Focus on constructive feedback
- Maintain professionalism

## 🙏 Recognition

Contributors will be recognized in:
- README.md contributors section
- Release notes
- Project documentation

## ❓ Questions?

- Check [CLAUDE.md](./CLAUDE.md) for architecture details
- Review [docs/](./docs/) for technical documentation
- Open a discussion on GitHub

## 📄 License

By contributing, you agree that your contributions will be licensed under the MIT License.

---

Thank you for contributing to NextReleaseMCP! 🎉
