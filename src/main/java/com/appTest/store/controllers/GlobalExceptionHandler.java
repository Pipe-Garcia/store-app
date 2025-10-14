package com.appTest.store.controllers;

import jakarta.persistence.EntityNotFoundException;
import org.springframework.http.*;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.*;

import java.util.*;

@RestControllerAdvice
public class GlobalExceptionHandler {

  @ExceptionHandler(EntityNotFoundException.class)
  public ResponseEntity<Map<String,Object>> notFound(EntityNotFoundException ex){
    return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of(
      "error","NOT_FOUND","message",ex.getMessage()
    ));
  }

  @ExceptionHandler(IllegalArgumentException.class)
  public ResponseEntity<Map<String,Object>> badInput(IllegalArgumentException ex){
    return ResponseEntity.status(HttpStatus.UNPROCESSABLE_ENTITY).body(Map.of(
      "error","UNPROCESSABLE_ENTITY","message",ex.getMessage()
    ));
  }

  @ExceptionHandler(IllegalStateException.class)
  public ResponseEntity<Map<String,Object>> conflict(IllegalStateException ex){
    return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of(
      "error","CONFLICT","message",ex.getMessage()
    ));
  }

  @ExceptionHandler(MethodArgumentNotValidException.class)
  public ResponseEntity<Map<String,Object>> validation(MethodArgumentNotValidException ex){
    var errors = new ArrayList<Map<String,String>>();
    ex.getBindingResult().getFieldErrors().forEach(fe ->
      errors.add(Map.of("field", fe.getField(), "message", fe.getDefaultMessage()))
    );
    return ResponseEntity.badRequest().body(Map.of(
      "error","BAD_REQUEST","details",errors
    ));
  }
}
