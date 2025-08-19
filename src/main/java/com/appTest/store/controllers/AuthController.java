package com.appTest.store.controllers;

import com.appTest.store.models.User;
import com.appTest.store.services.IUserService;
import com.appTest.store.utils.JWTUtil;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/auth")
public class AuthController {

    @Autowired
    private IUserService userService;

    @Autowired
    private JWTUtil jwtUtil;

    @PostMapping("/register")
    public ResponseEntity<?> register(@RequestBody User user) {
        if (userService.findByUsername(user.getUsername()).isPresent()) {
            return ResponseEntity.status(HttpStatus.CONFLICT)
                    .body("Username already exists");
        }
        return ResponseEntity.ok(userService.save(user));
    }

    @PostMapping("/login")
    public ResponseEntity<JwtResponse> login(@RequestBody LoginRequest loginRequest) {
        User user = userService.authenticate(loginRequest.username(), loginRequest.password());
        if (user != null) {
            String token = jwtUtil.create(
                    String.valueOf(user.getId()),
                    user.getUsername(),
                    user.getRole().name()
            );
            return ResponseEntity.ok(new JwtResponse(token));
        }
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                .body(new JwtResponse("Invalid credentials"));
    }


}

record LoginRequest(String username, String password) {}
record JwtResponse(String token) {}
