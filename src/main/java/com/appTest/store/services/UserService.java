package com.appTest.store.services;

import com.appTest.store.models.User;
import com.appTest.store.repositories.IUserRepository;
import de.mkammerer.argon2.Argon2;
import de.mkammerer.argon2.Argon2Factory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

@Service
public class UserService implements IUserService {

    @Autowired
    private IUserRepository userRepository;

    @Override
    public List<User> getAllUsers() {
        return userRepository.findAll();
    }

    @Override
    public Optional<User> findByUsername(String username) {
        return userRepository.findByUsername(username);
    }

    @Autowired private org.springframework.security.crypto.password.PasswordEncoder passwordEncoder;

    @Override
    @Transactional
    public User save(User user) {
        if (user.getPassword() != null && !user.getPassword().isBlank()) {
            String p = user.getPassword();
            boolean looksLikeBcrypt = p.startsWith("$2a$") || p.startsWith("$2b$") || p.startsWith("$2y$");
            if (!looksLikeBcrypt) {
                user.setPassword(passwordEncoder.encode(p)); // BCrypt
            }
        }
        return userRepository.save(user);
    }

    // ← ESTE metodo es el que usa tu AuthController
    public User authenticate(String username, String rawPassword) {
        return userRepository.findByUsername(username)
                .filter(User::isEnabled)
                .filter(u -> passwordEncoder.matches(rawPassword, u.getPassword())) // BCrypt
                .orElse(null);
    }

    @Override
    @Transactional
    public void deleteById(Long id) {
        userRepository.deleteById(id);
    }

    @Override
    public Optional<User> getById(Long id) {
        return userRepository.findById(id);
    }
}
