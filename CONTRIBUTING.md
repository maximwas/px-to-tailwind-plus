# Contributing to Px to Tailwind Converter

Thank you for your interest in contributing to the Px to Tailwind Converter extension! This document provides guidelines and information for contributors.

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (version 16 or higher)
- [VS Code](https://code.visualstudio.com/) (version 1.74 or higher)
- [Git](https://git-scm.com/)

### Development Setup

1. **Fork and Clone**
   ```bash
   git clone https://github.com/your-username/px-to-tailwind-converter.git
   cd px-to-tailwind-converter
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Build the Extension**
   ```bash
   npm run compile
   ```

4. **Run Tests**
   ```bash
   npm test
   ```

5. **Start Development**
   - Open the project in VS Code
   - Press `F5` to launch a new Extension Development Host
   - Test your changes in the development environment

## 🏗️ Project Structure

```
src/
├── extension.ts              # Main extension entry point
├── tailwindConverter.ts      # Core conversion logic
├── textProcessor.ts          # Document change processing
├── patternDetector.ts        # Pixel class pattern detection
├── replacementHandler.ts     # Text replacement operations
├── visualFeedback.ts         # Visual feedback system
├── hoverProvider.ts          # Hover tooltip provider
├── configManager.ts          # Configuration management
├── tailwindConfigReader.ts   # Tailwind config parsing
├── logger.ts                 # Logging system
├── errorHandler.ts           # Error handling
├── performanceOptimizer.ts   # Performance optimizations
├── types.ts                  # TypeScript type definitions
└── test/                     # Test files
    ├── *.test.ts             # Unit tests
    └── *.integration.test.ts # Integration tests
```

## 🧪 Testing

### Running Tests

```bash
# Run all tests
npm test

# Run specific test suite
npm test -- --grep "TailwindConverter"

# Run tests with coverage
npm run test:coverage
```

### Test Categories

1. **Unit Tests**: Test individual components in isolation
2. **Integration Tests**: Test component interactions
3. **End-to-End Tests**: Test complete user workflows
4. **Performance Tests**: Validate performance benchmarks

### Writing Tests

- Use descriptive test names that explain the expected behavior
- Follow the AAA pattern: Arrange, Act, Assert
- Test both success and failure scenarios
- Include edge cases and boundary conditions
- Maintain test coverage above 90%

Example test structure:
```typescript
suite('ComponentName Test Suite', () => {
    let component: ComponentName;

    setup(() => {
        component = new ComponentName();
    });

    teardown(() => {
        component.dispose();
    });

    suite('method name', () => {
        test('should handle normal case', () => {
            // Arrange
            const input = 'test input';
            
            // Act
            const result = component.method(input);
            
            // Assert
            assert.strictEqual(result, 'expected output');
        });
    });
});
```

## 🎯 Development Guidelines

### Code Style

- Use TypeScript for all new code
- Follow the existing code style and formatting
- Use meaningful variable and function names
- Add JSDoc comments for public APIs
- Keep functions small and focused

### Performance Considerations

- Use caching for expensive operations
- Implement debouncing for user input
- Optimize regex patterns for speed
- Monitor memory usage and prevent leaks
- Profile performance-critical code paths

### Error Handling

- Use the centralized error handling system
- Provide meaningful error messages
- Log errors with appropriate severity levels
- Handle edge cases gracefully
- Never let errors crash the extension

### Logging

- Use the structured logging system
- Log at appropriate levels (debug, info, warn, error)
- Include relevant context in log messages
- Avoid logging sensitive information
- Use performance measurements for optimization

## 🐛 Bug Reports

When reporting bugs, please include:

1. **Environment Information**
   - VS Code version
   - Extension version
   - Operating system
   - Node.js version

2. **Steps to Reproduce**
   - Clear, numbered steps
   - Sample code or files
   - Expected vs. actual behavior

3. **Additional Context**
   - Screenshots or recordings
   - Error messages or logs
   - Related configuration

## ✨ Feature Requests

For feature requests, please provide:

1. **Use Case**: Describe the problem you're trying to solve
2. **Proposed Solution**: How you envision the feature working
3. **Alternatives**: Other solutions you've considered
4. **Impact**: Who would benefit from this feature

## 📝 Pull Request Process

### Before Submitting

1. **Create an Issue**: Discuss the change before implementing
2. **Fork the Repository**: Work on your own fork
3. **Create a Branch**: Use a descriptive branch name
4. **Write Tests**: Ensure your changes are tested
5. **Update Documentation**: Keep docs in sync with changes

### Pull Request Guidelines

1. **Title**: Use a clear, descriptive title
2. **Description**: Explain what changes you made and why
3. **Testing**: Describe how you tested the changes
4. **Breaking Changes**: Highlight any breaking changes
5. **Screenshots**: Include visuals for UI changes

### Review Process

1. **Automated Checks**: Ensure all CI checks pass
2. **Code Review**: Address reviewer feedback
3. **Testing**: Verify changes work as expected
4. **Documentation**: Update relevant documentation
5. **Merge**: Maintainers will merge approved PRs

## 🏷️ Commit Message Format

Use conventional commit format:

```
type(scope): description

[optional body]

[optional footer]
```

Types:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes
- `refactor`: Code refactoring
- `test`: Test changes
- `chore`: Build/tooling changes

Examples:
```
feat(converter): add support for custom spacing scales
fix(textProcessor): handle malformed HTML gracefully
docs(readme): update installation instructions
```

## 🔧 Development Tools

### Recommended VS Code Extensions

- **TypeScript Importer**: Auto-import TypeScript modules
- **ESLint**: Code linting and formatting
- **Prettier**: Code formatting
- **Test Explorer**: Run and debug tests
- **GitLens**: Enhanced Git integration

### Debugging

1. **Extension Debugging**
   - Press `F5` to launch Extension Development Host
   - Set breakpoints in your code
   - Use the Debug Console for inspection

2. **Test Debugging**
   - Use the Test Explorer extension
   - Set breakpoints in test files
   - Debug individual test cases

## 📊 Performance Benchmarks

Maintain these performance targets:

- Extension activation: < 1000ms
- Small document processing: < 10ms
- Large document processing: < 500ms
- Memory usage: < 50MB during normal operation
- Test suite execution: < 30 seconds

## 🎨 UI/UX Guidelines

- Follow VS Code's design principles
- Use consistent visual feedback
- Provide clear error messages
- Ensure accessibility compliance
- Test with different themes

## 📚 Resources

- [VS Code Extension API](https://code.visualstudio.com/api)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [Node.js Documentation](https://nodejs.org/docs/)

## 🤝 Community

- **Discussions**: Use GitHub Discussions for questions and ideas
- **Issues**: Use GitHub Issues for bugs and feature requests
- **Email**: Contact maintainers at your.email@example.com

## 📄 License

By contributing to this project, you agree that your contributions will be licensed under the MIT License.

---

Thank you for contributing to make Tailwind development faster and more enjoyable for everyone! 🚀