package com.appTest.store.services;

import com.appTest.store.models.User;
import java.util.List;
import java.util.Optional;

public interface IUserService {
    List<User> getAllUsers();
    Optional<User> findByUsername(String username);
    User save(User user);
    User authenticate(String username, String password);
    void deleteById(Long id);
    Optional<User> getById(Long id);
}
