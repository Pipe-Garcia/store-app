package com.appTest.store.controllers;

import com.appTest.store.models.User;
import com.appTest.store.services.IUserService;
import com.appTest.store.utils.JWTUtil;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/auth")
public class AuthController {

    @Autowired
    private IUserService userService;

    @Autowired
    private JWTUtil jwtUtil;

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

    @GetMapping("/me")
    public ResponseEntity<?> me(@RequestHeader(name="Authorization", required=false) String auth){
        if (auth==null || !auth.startsWith("Bearer ")) return ResponseEntity.status(401).build();
        try{
            var token = auth.substring(7);
            var claims = jwtUtil.getAllClaims(token);
            String username = claims.getSubject();
            String role = (String) claims.get("role");
            var opt = userService.findByUsername(username);
            if (opt.isEmpty()) return ResponseEntity.status(401).build();
            var u = opt.get();
            record Me(Long id, String username, String name, String lastName, String role){}
            return ResponseEntity.ok(new Me(u.getId(), u.getUsername(), u.getName(), u.getLastName(), role));
        }catch(Exception e){
            return ResponseEntity.status(401).build();
        }
    }

    @PreAuthorize("hasRole('ROLE_OWNER')")
    @PostMapping("/register")
    public ResponseEntity<?> registerOwnerOnly(@RequestBody User user) {
        if (userService.findByUsername(user.getUsername()).isPresent()) {
            return ResponseEntity.status(HttpStatus.CONFLICT).body("Username already exists");
        }
        return ResponseEntity.ok(userService.save(user));
    }


}

record LoginRequest(String username, String password) {}
record JwtResponse(String token) {}
