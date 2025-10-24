package com.appTest.store.controllers;

import com.appTest.store.models.User;
import com.appTest.store.services.IUserService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/users")
public class UserController {

    @Autowired
    private IUserService servUser;

    @GetMapping("/{id}")
    public ResponseEntity<User> getById(@PathVariable Long id) {
        return servUser.getById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('ROLE_EMPLOYEE','ROLE_OWNER')")
    public List<User> getAllUsers() {
        return servUser.getAllUsers();
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ROLE_OWNER')")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        servUser.deleteById(id);
        return ResponseEntity.noContent().build();
    }

    @PreAuthorize("hasRole('ROLE_OWNER')")
    @PostMapping
    public ResponseEntity<User> create(@RequestBody User user){
        return ResponseEntity.ok(servUser.save(user));
    }

    @PreAuthorize("hasRole('ROLE_OWNER')")
    @PatchMapping("/{id}")
    public ResponseEntity<User> update(@PathVariable Long id, @RequestBody User partial){
        var opt = servUser.getById(id);
        if (opt.isEmpty()) return ResponseEntity.notFound().build();
        var u = opt.get();
        if (partial.getRole()!=null) u.setRole(partial.getRole());
        if (partial.getName()!=null) u.setName(partial.getName());
        if (partial.getLastName()!=null) u.setLastName(partial.getLastName());
        if (partial.getEmail()!=null) u.setEmail(partial.getEmail());
        if (partial.getPhone()!=null) u.setPhone(partial.getPhone());
        // reset pass si viene no vacío
        if (partial.getPassword()!=null && !partial.getPassword().isBlank()){
            u.setPassword(partial.getPassword());
        }
        u.setEnabled(partial.isEnabled());
        return ResponseEntity.ok(servUser.save(u));
    }

}
