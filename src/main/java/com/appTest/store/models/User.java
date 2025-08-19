package com.appTest.store.models;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

@Entity
@Getter @Setter
@Table(name = "users")
public class User {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(unique = true, nullable = false)
    private String username;

    private String name;
    private String lastName;
    private String email;
    private String phone;

    @Column(nullable = false)
    private String password;

    @Enumerated(EnumType.STRING)
    private Role role = Role.ROLE_EMPLOYEE;

    private boolean enabled = true;

    public enum Role {
        ROLE_EMPLOYEE,
        ROLE_OWNER
    }

    public User() {}

    public User(String email, boolean enabled, String lastName, String name, String password, String phone, Role role, String username) {
        this.email = email;
        this.enabled = enabled;
        this.lastName = lastName;
        this.name = name;
        this.password = password;
        this.phone = phone;
        this.role = role;
        this.username = username;
    }
}
